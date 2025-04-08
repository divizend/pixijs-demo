"use client";

import { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { DonutChart } from "@/components/DonutChart";
import { Slider } from "@/components/ui/slider";
import { formatEuro } from "@/lib/utils";

// Helper function to generate random data
const generateRandomData = (
  baseData: { id: string; value: number; color: number }[]
) => {
  return baseData.map((item) => ({
    ...item,
    value: Math.random() * 30,
  }));
};

// Initial sample data for the chart
const initialChartData = [
  { id: "segment1", value: 30, color: 0x4f46e5 },
  { id: "segment2", value: 50, color: 0x8b5cf6 },
  { id: "segment3", value: 70, color: 0xa78bfa },
  { id: "segment4", value: 40, color: 0xc4b5fd },
];

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const chartRef = useRef<DonutChart | null>(null);
  const [value, setValue] = useState(5000000); // Default to 5 million euros
  const [chartData, setChartData] = useState(initialChartData);

  // Set up interval to update data regularly
  useEffect(() => {
    const dataUpdateInterval = setInterval(() => {
      const newData = generateRandomData(chartData);
      setChartData(newData);
    }, 3000); // Update every 3 seconds

    return () => clearInterval(dataUpdateInterval);
  }, [chartData]);

  // Update chart when data changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.updateData(chartData);
    }
  }, [chartData]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create and initialize the PixiJS application
    const initializeApp = async () => {
      // Create a new application
      const app = new Application();

      // Save width and height
      const width = 600;
      const height = 350;

      // Initialize the application with desired configuration
      await app.init({
        width,
        height,
        antialias: true,
        backgroundColor: 0xffffff,
        backgroundAlpha: 0, // Make background transparent
        resolution: window.devicePixelRatio || 1, // Improve antialiasing
        autoDensity: true, // Improve rendering quality
      });

      // Append the canvas to the container
      containerRef.current!.appendChild(app.canvas);

      // Store reference to the app
      appRef.current = app;

      // Create the donut chart
      const chart = new DonutChart(app, {
        width,
        height,
        data: chartData,
        innerRadius: 100,
        outerRadius: 160,
        popDistance: 15,
        startAngle: -Math.PI, // Start from the left side (180 degrees)
        endAngle: 0, // End at the right side (0 degrees)
        euroValue: value, // Initial value
      });

      // Store reference to chart for cleanup
      chartRef.current = chart;
    };

    initializeApp();

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      if (appRef.current) {
        appRef.current.destroy();
        appRef.current = null;
      }
    };
  }, []);

  // Update the chart when value changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.updateEuroValue(value);
    }
  }, [value]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Chart container with dashed border */}
        <div
          ref={containerRef}
          className="relative w-full h-[350px] flex items-center justify-center border-2 border-dashed border-slate-300 rounded-md p-4"
        />

        {/* Slider component - placed with appropriate spacing */}
        <div className="w-full px-4 mt-8">
          <Slider
            defaultValue={[value]}
            max={10000000}
            step={100000}
            onValueChange={(vals) => setValue(vals[0])}
          />
        </div>

        <div className="w-full flex justify-between mt-2 text-sm text-slate-500">
          <span>€0</span>
          <span>€10,000,000</span>
        </div>
      </div>
    </div>
  );
}
