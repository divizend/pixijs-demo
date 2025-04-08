import { Application, Container, Graphics, Text } from "pixi.js";
import gsap from "gsap";
import { formatEuro } from "@/lib/utils";

interface DonutChartData {
  value: number;
  color: number;
  id?: string | number; // Add id to track slices across updates
}

interface DonutChartOptions {
  data: DonutChartData[];
  innerRadius: number;
  outerRadius: number;
  popDistance: number;
  width: number;
  height: number;
  startAngle?: number;
  endAngle?: number;
  euroValue?: number;
}

interface SliceData {
  container: Container;
  value: number;
  startAngle: number;
  endAngle: number;
  id: string | number;
}

export class DonutChart {
  private app: Application;
  private options: DonutChartOptions;
  private slices: SliceData[] = [];
  private chartContainer: Container | null = null;
  private valueText: Text | null = null;
  private animating: boolean = false;

  constructor(app: Application, options: DonutChartOptions) {
    this.app = app;
    this.options = {
      startAngle: -Math.PI, // Default to half donut (top half)
      endAngle: 0,
      euroValue: 0,
      ...options,
    };

    // Ensure each data item has an id
    this.options.data = this.options.data.map((item, index) => ({
      ...item,
      id: item.id || `slice-${index}`,
    }));

    // Create the chart
    this.createChart();

    // Add Euro value text
    this.createEuroText();
  }

  /**
   * Update the Euro value display
   */
  public updateEuroValue(value: number): void {
    this.options.euroValue = value;
    if (this.valueText) {
      this.valueText.text = formatEuro(value);
    }
  }

  /**
   * Update chart data and animate transitions
   */
  public updateData(newData: DonutChartData[]): void {
    if (this.animating) return;
    this.animating = true;

    // Ensure each new data item has an id
    const data = newData.map((item, index) => ({
      ...item,
      id: item.id || `slice-${index}`,
    }));

    // Store the current angles for animation
    const oldSlices = [...this.slices];

    // Calculate new angles
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const totalAngle = this.options.endAngle! - this.options.startAngle!;

    // Prepare new slice data
    const newSlices: SliceData[] = [];

    // Calculate all angles upfront to ensure precise positioning
    const angleData = data.map((item) => ({
      id: item.id,
      value: item.value,
      color: item.color,
      percentage: item.value / total,
    }));

    // Ensure segments sum to exactly the total angle to prevent gaps
    let currentAngle = this.options.startAngle!;
    const lastIndex = angleData.length - 1;

    angleData.forEach((item, index) => {
      let endAngle: number;

      if (index === lastIndex) {
        // Force the last segment to end exactly at the end angle
        endAngle = this.options.endAngle!;
      } else {
        // Calculate precise segment angle
        const segmentAngle = item.percentage * totalAngle;
        endAngle = currentAngle + segmentAngle;
      }

      // Find if this is an existing slice or a new one
      const sliceData = data.find((d) => d.id === item.id);
      const existingSlice = oldSlices.find((slice) => slice.id === item.id);

      if (existingSlice && sliceData) {
        // Update existing slice
        newSlices.push({
          container: existingSlice.container,
          value: sliceData.value,
          startAngle: currentAngle,
          endAngle: endAngle,
          id: item.id as string | number,
        });
      } else if (sliceData) {
        // Create new slice
        const slice = new Graphics();
        const sliceContainer = new Container();
        sliceContainer.addChild(slice);

        // Set pivot point to origin for proper scaling from center
        sliceContainer.pivot.set(0, 0);

        this.chartContainer?.addChild(sliceContainer);

        // Calculate midAngle for click handler
        const midAngle = (currentAngle + endAngle) / 2;
        slice.on("pointerdown", () =>
          this.handleSliceClick(sliceContainer, midAngle)
        );

        newSlices.push({
          container: sliceContainer,
          value: sliceData.value,
          startAngle: currentAngle,
          endAngle: endAngle,
          id: item.id as string | number,
        });
      }

      // Set the next segment's start angle to this segment's end angle
      currentAngle = endAngle;
    });

    // Animation setup - create individual animations for each slice
    const timeline = gsap.timeline({
      onComplete: () => {
        this.slices = newSlices;

        // Remove any slices that are no longer needed
        oldSlices.forEach((oldSlice) => {
          if (!newSlices.find((slice) => slice.id === oldSlice.id)) {
            oldSlice.container.parent?.removeChild(oldSlice.container);
          }
        });

        this.animating = false;
      },
    });

    // Create individual animations for each slice
    newSlices.forEach((newSlice, index) => {
      const slice = newSlice.container.getChildAt(0) as Graphics;
      const oldSlice = oldSlices.find((slice) => slice.id === newSlice.id);

      // Create animation object
      const animProps = {
        startAngle: oldSlice ? oldSlice.startAngle : newSlice.startAngle,
        endAngle: oldSlice ? oldSlice.endAngle : newSlice.startAngle, // Start at zero width for new slices
      };

      // Target values
      const targetProps = {
        startAngle: newSlice.startAngle,
        endAngle: newSlice.endAngle,
      };

      // Find the data item for color
      const dataItem = data.find((item) => item.id === newSlice.id);
      const color = dataItem?.color || 0xffffff;

      // Add to timeline - stagger slightly for visual effect
      timeline.to(
        animProps,
        {
          startAngle: targetProps.startAngle,
          endAngle: targetProps.endAngle,
          duration: 0.8,
          ease: "power2.inOut",
          delay: index * 0.05, // Small stagger for visual effect
          onUpdate: () => {
            this.drawDonutSlice(
              slice,
              this.options.innerRadius,
              this.options.outerRadius,
              animProps.startAngle,
              animProps.endAngle,
              color
            );
          },
        },
        index === 0 ? 0 : "-=0.75"
      ); // Overlap animations for smoother effect
    });

    // Update stored data reference
    this.options.data = [...data];
  }

  /**
   * Clean up resources when the chart is no longer needed
   */
  public destroy(): void {
    // Remove all event listeners from slices
    this.removeEventListeners();

    // Clear references
    this.chartContainer = null;
    this.slices = [];
    this.valueText = null;
  }

  /**
   * Create text display for Euro value
   */
  private createEuroText(): void {
    this.valueText = new Text({
      text: formatEuro(this.options.euroValue || 0),
      style: {
        fontFamily: "Geist",
        fontSize: 24,
        fontWeight: "bold",
        fill: 0x333333,
        align: "center",
      },
    });

    // Position the text inside the half-donut
    // Anchor at center-center for proper positioning
    this.valueText.anchor.set(0.5, -0.5);

    // Center horizontally
    this.valueText.x = this.options.width / 2;

    // Adjust vertical position to match the new chart position
    // Move the text down to match the new chart position
    this.valueText.y =
      this.options.height * 0.6 - this.options.innerRadius * 0.5;

    this.app.stage.addChild(this.valueText);
  }

  /**
   * Create the donut chart with interactive slices
   */
  private createChart(): void {
    // Create a container for the entire chart
    this.chartContainer = new Container();

    // Center horizontally, but move down vertically
    this.chartContainer.x = this.options.width / 2;
    // Position it at 60% of the height instead of center (50%)
    this.chartContainer.y = this.options.height * 0.6;

    this.app.stage.addChild(this.chartContainer);

    // Calculate the total value for angle determination
    const total = this.options.data.reduce((sum, d) => sum + d.value, 0);
    let startAngle = this.options.startAngle!;
    const totalAngle = this.options.endAngle! - this.options.startAngle!;

    // Create each slice of the donut chart
    this.options.data.forEach((sliceData, index) => {
      const sliceAngle = (sliceData.value / total) * totalAngle;

      // For the last slice, ensure it ends exactly at the end angle
      const endAngle =
        index === this.options.data.length - 1
          ? this.options.endAngle!
          : startAngle + sliceAngle;

      const midAngle = (startAngle + endAngle) / 2;

      // Create the slice graphics
      const slice = new Graphics();
      this.drawDonutSlice(
        slice,
        this.options.innerRadius,
        this.options.outerRadius,
        startAngle,
        endAngle,
        sliceData.color
      );

      // Set up interactivity
      slice.eventMode = "static";
      slice.cursor = "pointer";

      // Create a container for the slice (for positioning)
      const sliceContainer = new Container();
      sliceContainer.addChild(slice);

      // Set pivot point to origin (0,0) so scaling happens from the center of the donut
      // Since the container is already positioned at the center of the chart in the parent container,
      // this ensures scaling happens from the center of the donut
      sliceContainer.pivot.set(0, 0);

      this.chartContainer?.addChild(sliceContainer);

      // Store slice data
      this.slices.push({
        container: sliceContainer,
        value: sliceData.value,
        startAngle,
        endAngle,
        id: sliceData.id as string | number,
      });

      // Set up the click event
      slice.on("pointerdown", () =>
        this.handleSliceClick(sliceContainer, midAngle)
      );

      startAngle = endAngle;
    });
  }

  /**
   * Handle slice click animation
   */
  private handleSliceClick(sliceContainer: Container, midAngle: number): void {
    const offsetX = Math.cos(midAngle) * this.options.popDistance;
    const offsetY = Math.sin(midAngle) * this.options.popDistance;
    const scaleFactor = 1.15; // Scale up by 15%

    // Create a timeline for coordinated animations
    const timeline = gsap.timeline();

    // Add position animation (the existing bounce effect)
    timeline.to(sliceContainer.position, {
      x: offsetX,
      y: offsetY,
      duration: 0.2,
      ease: "power1.out",
    });

    // Add scale animation simultaneously
    timeline.to(
      sliceContainer.scale,
      {
        x: scaleFactor,
        y: scaleFactor,
        duration: 0.2,
        ease: "power1.out",
      },
      "<"
    ); // "<" means "start at the same time as the previous animation"

    // Return to original position and scale
    timeline.to(
      sliceContainer.position,
      {
        x: 0,
        y: 0,
        duration: 0.2,
        ease: "power1.in",
      },
      ">"
    );

    timeline.to(
      sliceContainer.scale,
      {
        x: 1,
        y: 1,
        duration: 0.2,
        ease: "power1.in",
      },
      "<"
    ); // Start at the same time as the return position animation
  }

  /**
   * Draw a donut slice with the specified dimensions and color
   */
  private drawDonutSlice(
    graphics: Graphics,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number,
    color: number
  ): void {
    graphics.clear();

    // Apply anti-aliasing specific settings for better edges
    graphics.fill({ color, alpha: 1 });

    // Use a higher precision for curves
    const precision = 0.03; // Even lower value for better precision

    // Calculate points for smooth curved edges
    const points = [];

    // Outer arc - forward direction
    for (let angle = startAngle; angle <= endAngle; angle += precision) {
      points.push({
        x: Math.cos(angle) * outerRadius,
        y: Math.sin(angle) * outerRadius,
      });
    }

    // Ensure the end point is included
    points.push({
      x: Math.cos(endAngle) * outerRadius,
      y: Math.sin(endAngle) * outerRadius,
    });

    // Inner arc - reverse direction
    for (let angle = endAngle; angle >= startAngle; angle -= precision) {
      points.push({
        x: Math.cos(angle) * innerRadius,
        y: Math.sin(angle) * innerRadius,
      });
    }

    // Ensure the start point is included
    points.push({
      x: Math.cos(startAngle) * innerRadius,
      y: Math.sin(startAngle) * innerRadius,
    });

    // Draw the shape with the calculated points
    graphics.beginFill(color);
    graphics.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }

    graphics.closePath();
    graphics.endFill();
  }

  /**
   * Remove all event listeners from chart elements
   */
  private removeEventListeners(): void {
    this.slices.forEach((slice) => {
      const graphic = slice.container.getChildAt(0);
      if (graphic) {
        graphic.removeAllListeners();
      }
    });
  }
}
