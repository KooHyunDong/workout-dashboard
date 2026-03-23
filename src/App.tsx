/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, 
  Plus, 
  Trash2, 
  Activity, 
  Flame, 
  Clock, 
  Heart,
  ChevronRight,
  BarChart3,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Workout {
  id: string;
  date: string;
  type: string;
  durationSeconds: number;
  activeCalories: number;
  totalCalories: number;
  avgHeartRate: number;
  imageUrl?: string;
}

// --- AI Service ---
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const WORKOUT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description: "The date of the workout (e.g., 'March 16' or '3월 16일').",
    },
    type: {
      type: Type.STRING,
      description: "The type of exercise (e.g., 'Ballet Bar', 'Running').",
    },
    duration: {
      type: Type.STRING,
      description: "The duration of the workout in H:MM:SS format.",
    },
    activeCalories: {
      type: Type.NUMBER,
      description: "Active calories burned (kcal).",
    },
    totalCalories: {
      type: Type.NUMBER,
      description: "Total calories burned (kcal).",
    },
    avgHeartRate: {
      type: Type.NUMBER,
      description: "Average heart rate (bpm).",
    },
  },
  required: ["date", "type", "duration", "activeCalories", "totalCalories", "avgHeartRate"],
};

// --- Helper Functions ---
const parseDuration = (durationStr: string): number => {
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Components ---

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const processImages = async (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: fileArray.length });
    setError(null);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setProcessingProgress(prev => ({ ...prev, current: i + 1 }));
      
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        const imageUrl = URL.createObjectURL(file);

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { text: "Extract workout details from this screenshot. Return only the JSON data." },
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: WORKOUT_SCHEMA,
          },
        });

        const result = JSON.parse(response.text);
        
        const newWorkout: Workout = {
          id: Math.random().toString(36).substr(2, 9),
          date: result.date,
          type: result.type,
          durationSeconds: parseDuration(result.duration),
          activeCalories: result.activeCalories,
          totalCalories: result.totalCalories,
          avgHeartRate: result.avgHeartRate,
          imageUrl,
        };

        setWorkouts(prev => [newWorkout, ...prev]);
      } catch (err) {
        console.error(`Failed to process file ${file.name}:`, err);
        setError(prev => (prev ? prev + "\n" : "") + `Failed to parse ${file.name}.`);
      }
    }
    
    setIsProcessing(false);
    setProcessingProgress({ current: 0, total: 0 });
  };

  const removeWorkout = (id: string) => {
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  // --- Aggregates ---
  const stats = useMemo(() => {
    if (workouts.length === 0) return null;
    
    const totalDuration = workouts.reduce((acc, w) => acc + w.durationSeconds, 0);
    const totalActiveCals = workouts.reduce((acc, w) => acc + w.activeCalories, 0);
    const avgHeartRate = Math.round(workouts.reduce((acc, w) => acc + w.avgHeartRate, 0) / workouts.length);
    
    return {
      totalDuration,
      totalActiveCals,
      avgHeartRate,
      count: workouts.length
    };
  }, [workouts]);

  const chartData = useMemo(() => {
    return workouts.slice().reverse().map(w => ({
      name: w.date,
      calories: w.activeCalories,
      duration: Math.round(w.durationSeconds / 60)
    }));
  }, [workouts]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Activity className="text-white w-5 h-5" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Workout Analytics</h1>
          </div>
          <div className="text-xs font-medium text-black/40 uppercase tracking-widest">
            K.H.D
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upload & List */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Upload Area */}
          <div 
            className={cn(
              "relative group border-2 border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center gap-4 bg-white",
              isProcessing ? "border-emerald-200 bg-emerald-50/30" : "border-black/10 hover:border-emerald-400 hover:bg-emerald-50/10"
            )}
          >
            <input 
              type="file" 
              accept="image/*" 
              multiple
              onChange={(e) => e.target.files && processImages(e.target.files)}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              disabled={isProcessing}
            />
            
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
              isProcessing ? "bg-emerald-100 animate-pulse" : "bg-emerald-50"
            )}>
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="text-emerald-600 w-6 h-6" />
              )}
            </div>
            
            <div className="text-center">
              <p className="font-medium text-sm">
                {isProcessing 
                  ? `Processing ${processingProgress.current} of ${processingProgress.total}...` 
                  : "Drop workout screenshots here"}
              </p>
              <p className="text-xs text-black/40 mt-1">
                Select multiple images to batch process
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* Workout List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-black/40">Recent Workouts</h2>
              <span className="text-xs font-medium bg-black/5 px-2 py-0.5 rounded-full">{workouts.length}</span>
            </div>

            {workouts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-black/5">
                <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="text-black/20 w-6 h-6" />
                </div>
                <p className="text-sm text-black/40">No workouts added yet. Upload a screenshot to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workouts.map((workout) => (
                  <div 
                    key={workout.id}
                    className="bg-white rounded-2xl p-4 border border-black/5 flex items-center gap-4 group hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {workout.imageUrl ? (
                        <img src={workout.imageUrl} alt="Workout" className="w-full h-full object-cover opacity-50 hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                      ) : (
                        <Activity className="text-emerald-600 w-6 h-6" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{workout.type}</h3>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          {workout.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-black/40 font-medium">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(workout.durationSeconds)}</span>
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {workout.activeCalories} kcal</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {workout.avgHeartRate} bpm</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => removeWorkout(workout.id)}
                      className="p-2 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stats & Charts */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-orange-50 rounded-lg">
                  <Flame className="text-orange-500 w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-black/40">Total Burn</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight">{stats?.totalActiveCals || 0}</span>
                <span className="text-xs font-medium text-black/40">kcal</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <Clock className="text-blue-500 w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-black/40">Time Spent</span>
              </div>
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-2xl font-bold tracking-tight">
                  {stats ? Math.floor(stats.totalDuration / 3600) : 0}
                </span>
                <span className="text-xs font-medium text-black/40">hrs</span>
                <span className="text-2xl font-bold tracking-tight ml-1">
                  {stats ? Math.floor((stats.totalDuration % 3600) / 60) : 0}
                </span>
                <span className="text-xs font-medium text-black/40">min</span>
                <span className="text-2xl font-bold tracking-tight ml-1">
                  {stats ? stats.totalDuration % 60 : 0}
                </span>
                <span className="text-xs font-medium text-black/40">sec</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-50 rounded-lg">
                    <Heart className="text-rose-500 w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-black/40">Avg Intensity</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold tracking-tight">{stats?.avgHeartRate || 0}</span>
                  <span className="text-xs font-medium text-black/40">bpm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-emerald-500 w-5 h-5" />
                <h3 className="font-semibold text-sm">Activity Trend</h3>
              </div>
              <select className="text-[11px] font-bold uppercase tracking-wider bg-black/5 border-none rounded-lg px-2 py-1 focus:ring-0">
                <option>Last 7 Days</option>
              </select>
            </div>

            <div className="h-[240px] w-full">
              {workouts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#A3A3A3' }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#A3A3A3' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#F9F9F9' }}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#10B981' : '#E5E7EB'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-black/20 gap-2">
                  <BarChart3 className="w-8 h-8 opacity-20" />
                  <p className="text-xs font-medium">No data to display</p>
                </div>
              )}
            </div>
          </div>

          {/* Tips / Info */}
          <div className="bg-emerald-900 rounded-2xl p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
              <h4 className="font-semibold text-sm mb-2">Pro Tip</h4>
              <p className="text-xs text-emerald-100/70 leading-relaxed">
                Upload multiple screenshots to see your weekly progress. The AI automatically detects workout types and metrics.
              </p>
            </div>
            <Activity className="absolute -bottom-4 -right-4 w-24 h-24 text-white/5 rotate-12" />
          </div>

        </div>
      </main>
    </div>
  );
}
