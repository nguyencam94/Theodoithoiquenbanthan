import React, { useState, useMemo, useEffect, Component } from 'react';
import { 
  Check, 
  Plus, 
  Minus,
  Dumbbell, 
  Book, 
  Coffee, 
  Moon, 
  Sun, 
  Heart, 
  Briefcase, 
  ChevronRight,
  MoreVertical,
  Trash2,
  Pencil,
  Bell,
  Settings,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  StickyNote,
  X,
  Upload,
  Target,
  BarChart2,
  Home,
  TrendingUp,
  Award,
  LogOut,
  LogIn,
  User as UserIcon,
  Facebook,
  Sparkles,
  Zap,
  Flame,
  CheckCircle2,
  Activity,
  Clock,
  ArrowRight
} from 'lucide-react';
import { auth, db, loginWithGoogle, loginWithFacebook, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  subDays, 
  isSameDay, 
  startOfMonth, 
  endOfMonth,
  subMonths,
  subYears,
  startOfYear,
  endOfYear
} from 'date-fns';
import { vi } from 'date-fns/locale';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in HabitFlow:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-sm w-full border border-slate-100 dark:border-slate-700">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sun className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Đã xảy ra lỗi nhỏ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Ứng dụng đã gặp sự cố khi hiển thị. Vui lòng tải lại trang.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 dark:shadow-none"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Types ---

type Category = string;

interface HabitLog {
  date: string;
  note?: string;
  imageUrl?: string;
  count: number;
}

interface Habit {
  id: string;
  name: string;
  category: Exclude<Category, 'Tất cả'>;
  icon: React.ReactNode;
  completedDays: string[]; // Keep for backward compatibility/simplicity in progress calc
  logs: Record<string, HabitLog>; // Key is date string YYYY-MM-DD
  color: string;
  targetCount: number;
}

// --- Constants ---

const DEFAULT_CATEGORIES = ['Tất cả', 'Sức khỏe', 'Học tập', 'Công việc', 'Cá nhân'];

const DEFAULT_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Sức khỏe': <Dumbbell className="w-4 h-4" />,
  'Học tập': <Book className="w-4 h-4" />,
  'Công việc': <Briefcase className="w-4 h-4" />,
  'Cá nhân': <Heart className="w-4 h-4" />,
};

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'Sức khỏe': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Học tập': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Công việc': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  'Cá nhân': 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
};

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// --- Helper Functions ---

const getIconComponent = (name: string) => {
  const className = "w-4 h-4";
  switch (name) {
    case 'dumbbell': return <Dumbbell className={className} />;
    case 'book': return <Book className={className} />;
    case 'briefcase': return <Briefcase className={className} />;
    case 'heart': return <Heart className={className} />;
    case 'coffee': return <Coffee className={className} />;
    case 'sun': return <Sun className={className} />;
    case 'moon': return <Moon className={className} />;
    default: return <Sun className={className} />;
  }
};

const DEFAULT_CATEGORY_ICON_NAMES: Record<string, string> = {
  'Sức khỏe': 'dumbbell',
  'Học tập': 'book',
  'Công việc': 'briefcase',
  'Cá nhân': 'heart'
};

const getInitialHabits = (): Habit[] => [];

const ProgressCircle = ({ current, target, size = 32 }: { current: number, target: number, size?: number }) => {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / target, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-slate-100"
          strokeWidth="3"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-indigo-600 transition-all duration-500 ease-out"
          strokeWidth="3"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {current >= target ? (
          <Check className="w-4 h-4 text-indigo-600" />
        ) : (
          <span className="text-[10px] font-bold text-slate-600">{current}</span>
        )}
      </div>
    </div>
  );
};

const getFormattedDate = (date: Date) => {
  return format(date, 'yyyy-MM-dd');
};

const getWeekDays = () => {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: endOfWeek(now, { weekStartsOn: 1 }) });
};

const calculateLongestStreak = (completedDays: string[]) => {
  if (completedDays.length === 0) return 0;
  
  const sortedDays = [...completedDays].sort();
  let longestStreak = 0;
  let currentStreak = 1;
  
  for (let i = 1; i < sortedDays.length; i++) {
    const prevDate = new Date(sortedDays[i - 1]);
    const currDate = new Date(sortedDays[i]);
    
    // Check if currDate is exactly one day after prevDate
    const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      currentStreak++;
    } else if (diffDays > 1) {
      longestStreak = Math.max(longestStreak, currentStreak);
      currentStreak = 1;
    }
  }
  
  return Math.max(longestStreak, currentStreak);
};

interface Habit21DaysModalProps {
  habit: Habit;
  categoryColors: Record<string, string>;
  categoryIcons: Record<string, React.ReactNode>;
  onClose: () => void;
}

const Habit21DaysModal = ({ habit, categoryColors, categoryIcons, onClose }: Habit21DaysModalProps) => {
  const analysis = useMemo(() => {
    const today = new Date();
    // 21 days from (today - 20 days) up to today
    const days: { date: Date; dateStr: string; dayIndex: number; isCompleted: boolean; isToday: boolean }[] = [];
    for (let i = 20; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      days.push({
        date: d,
        dateStr,
        dayIndex: 21 - i, // 1 to 21
        isCompleted: habit.completedDays.includes(dateStr),
        isToday: i === 0,
      });
    }

    const completedCount = days.filter(d => d.isCompleted).length;
    const rate = Math.round((completedCount / 21) * 100);

    // 3 Stages: Week 1 (1-7), Week 2 (8-14), Week 3 (15-21)
    const week1Days = days.slice(0, 7);
    const week1Count = week1Days.filter(d => d.isCompleted).length;
    const week1Rate = Math.round((week1Count / 7) * 100);

    const week2Days = days.slice(7, 14);
    const week2Count = week2Days.filter(d => d.isCompleted).length;
    const week2Rate = Math.round((week2Count / 7) * 100);

    const week3Days = days.slice(14, 21);
    const week3Count = week3Days.filter(d => d.isCompleted).length;
    const week3Rate = Math.round((week3Count / 7) * 100);

    // Current consecutive streak ending today
    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].isCompleted) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak within these 21 days
    let maxStreak = 0;
    let tempStreak = 0;
    for (const d of days) {
      if (d.isCompleted) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // Dynamic motivational assessments
    let assessment = {
      title: '',
      message: '',
      badge: '',
      badgeColor: '',
      themeColor: '',
      icon: 'sparkles' as 'sparkles' | 'flame' | 'zap' | 'activity',
      coachingTip: '',
    };

    if (rate >= 80) {
      assessment = {
        title: 'Yes! Bạn đã làm chủ thói quen này!',
        message: `Xuất sắc! Bạn đã thực hiện ${completedCount}/21 ngày (${rate}%). Hành động này đã dần biến thành phản xạ tự nhiên trong tiềm thức theo quy tắc 21 ngày!`,
        badge: 'Phản xạ tự nhiên 🌟',
        badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        themeColor: 'from-emerald-600 to-teal-700',
        icon: 'sparkles',
        coachingTip: 'Bạn đã xây dựng thành công rãnh liên kết thần kinh mới. Hãy tiếp tục duy trì để thói quen bền bỉ suốt cả năm!',
      };
    } else if (rate >= 60) {
      assessment = {
        title: 'Yes, bạn sắp đạt được thói quen này rồi!',
        message: `Tuyệt vời! Bạn đã đạt ${completedCount}/21 ngày (${rate}%). Bạn đang ở giai đoạn then chốt để củng cố nếp sống mới. Đừng dừng lại lúc này!`,
        badge: 'Sắp hoàn thành 🔥',
        badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        themeColor: 'from-indigo-600 to-violet-700',
        icon: 'flame',
        coachingTip: 'Chỉ cần thêm vài ngày kiên định nữa, bộ não của bạn sẽ tự động thực hiện mà không cần tốn nhiều ý chí.',
      };
    } else if (rate >= 35) {
      assessment = {
        title: 'Bạn đang tiến bộ, hãy kiên trì hơn!',
        message: `Bạn đã thực hiện ${completedCount}/21 ngày (${rate}%). Bạn có sự nỗ lực tốt nhưng đôi khi bị ngắt quãng. Hãy gắn thói quen này với một hành động cố định hàng ngày!`,
        badge: 'Cần duy trì đều ⚡',
        badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        themeColor: 'from-amber-500 to-orange-600',
        icon: 'zap',
        coachingTip: 'Thử áp dụng quy tắc "2 phút bắt đầu": chỉ cần làm một chút mỗi ngày thay vì chờ đợi thời điểm hoàn hảo.',
      };
    } else {
      assessment = {
        title: 'Oh, bạn hơi xao lãng rồi, hãy tập trung vào mục tiêu đi!',
        message: `Trong 21 ngày qua bạn mới thực hiện ${completedCount}/21 ngày (${rate}%). Đừng nản lòng, bất kỳ thói quen vĩ đại nào cũng bắt đầu lại từ ngày hôm nay!`,
        badge: 'Cần tập trung lại 🌱',
        badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        themeColor: 'from-rose-500 to-pink-600',
        icon: 'activity',
        coachingTip: 'Hãy đặt chuông nhắc nhở và chuẩn bị sẵn mọi điều kiện từ tối hôm trước để dễ dàng thực hiện vào hôm nay.',
      };
    }

    return {
      days,
      completedCount,
      rate,
      week1Days,
      week1Count,
      week1Rate,
      week2Days,
      week2Count,
      week2Rate,
      week3Days,
      week3Count,
      week3Rate,
      currentStreak,
      maxStreak,
      assessment,
    };
  }, [habit]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-100 dark:shadow-none">
                21
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-base text-slate-800 dark:text-slate-100 leading-tight">
                    {habit.name}
                  </h3>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8.5px] font-bold uppercase border ${categoryColors[habit.category] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                    {categoryIcons[habit.category] || <Sun className="w-2.5 h-2.5" />}
                    {habit.category}
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                  Phân tích chu kỳ 21 ngày hình thành thói quen
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200/60 dark:border-slate-700 transition-all shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-5">
            {/* Hero Motivational Banner */}
            <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-xl shadow-indigo-100 dark:shadow-none">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-white/20 backdrop-blur-md text-white border border-white/20">
                  {analysis.assessment.icon === 'sparkles' && <Sparkles className="w-3 h-3 text-amber-300" />}
                  {analysis.assessment.icon === 'flame' && <Flame className="w-3 h-3 text-amber-300" />}
                  {analysis.assessment.icon === 'zap' && <Zap className="w-3 h-3 text-amber-300" />}
                  {analysis.assessment.icon === 'activity' && <Activity className="w-3 h-3 text-rose-300" />}
                  {analysis.assessment.badge}
                </span>

                <div className="text-right">
                  <div className="text-2xl font-black tracking-tight">{analysis.completedCount}/21</div>
                  <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Ngày ({analysis.rate}%)</div>
                </div>
              </div>

              <h4 className="text-lg font-black tracking-tight mb-2 text-white">
                {analysis.assessment.title}
              </h4>
              <p className="text-xs text-indigo-100 leading-relaxed mb-3">
                {analysis.assessment.message}
              </p>

              <div className="pt-3 border-t border-white/15 flex items-center gap-2 text-[11px] text-indigo-100 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span><strong className="text-white font-bold">Lời khuyên:</strong> {analysis.assessment.coachingTip}</span>
              </div>
            </div>

            {/* 3-Week Psychological Stages */}
            <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  3 Giai đoạn tiến hóa (Quy tắc 3 tuần)
                </h4>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">21 Ngày</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Stage 1 */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/80">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Tuần 1 (N1-7)</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">Khởi động</div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-1">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${analysis.week1Rate}%` }} 
                    />
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{analysis.week1Count}/7 ngày</div>
                </div>

                {/* Stage 2 */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/80">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Tuần 2 (N8-14)</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">Vượt ngưỡng</div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-1">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${analysis.week2Rate}%` }} 
                    />
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{analysis.week2Count}/7 ngày</div>
                </div>

                {/* Stage 3 */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/80">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Tuần 3 (N15-21)</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">Khắc sâu</div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-1">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${analysis.week3Rate}%` }} 
                    />
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{analysis.week3Count}/7 ngày</div>
                </div>
              </div>
            </div>

            {/* 21-Day Interactive Day Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Hành trình chi tiết 21 ngày gần nhất
                </h4>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Từ {format(analysis.days[0].date, 'dd/MM')} đến hôm nay
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {analysis.days.map((item) => (
                  <div
                    key={item.dateStr}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all border ${
                      item.isCompleted
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-100 dark:shadow-none font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700/80 font-medium'
                    } ${item.isToday ? 'ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                    title={`${format(item.date, 'dd/MM/yyyy')}: ${item.isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành'}`}
                  >
                    <span className={`text-[8.5px] font-black uppercase tracking-tighter ${item.isCompleted ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      N{item.dayIndex}
                    </span>
                    <div className="my-0.5">
                      {item.isCompleted ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      )}
                    </div>
                    <span className={`text-[7.5px] ${item.isCompleted ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      {format(item.date, 'dd/MM')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Tỷ lệ 21 ngày</p>
                <h5 className="text-base font-black text-indigo-600 dark:text-indigo-400">{analysis.rate}%</h5>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Chuỗi dài nhất</p>
                <h5 className="text-base font-black text-slate-900 dark:text-white">{analysis.maxStreak} ngày</h5>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Chuỗi hiện tại</p>
                <h5 className="text-base font-black text-slate-900 dark:text-white">{analysis.currentStreak} ngày</h5>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Tổng số ngày</p>
                <h5 className="text-base font-black text-slate-900 dark:text-white">{habit.completedDays.length} ngày</h5>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onClose}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-[0.98]"
            >
              Tiếp tục duy trì thói quen
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const StatsPage = ({ 
  habits,
  categoryColors = {},
  categoryIcons = {},
  onModalToggle
}: { 
  habits: Habit[];
  categoryColors?: Record<string, string>;
  categoryIcons?: Record<string, React.ReactNode>;
  onModalToggle?: (isOpen: boolean) => void;
}) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [selectedHabitFor21Days, setSelectedHabitFor21Days] = useState<Habit | null>(null);

  const handleOpen21Days = (habit: Habit) => {
    setSelectedHabitFor21Days(habit);
    onModalToggle?.(true);
  };

  const handleClose21Days = () => {
    setSelectedHabitFor21Days(null);
    onModalToggle?.(false);
  };

  const timeRangeDays = useMemo(() => {
    const now = new Date();
    if (timeRange === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end: endOfWeek(now, { weekStartsOn: 1 }) });
    } else if (timeRange === 'month') {
      const start = startOfMonth(now);
      return eachDayOfInterval({ start, end: endOfMonth(now) });
    } else {
      const start = startOfYear(now);
      return eachDayOfInterval({ start, end: endOfYear(now) });
    }
  }, [timeRange]);

  const totalCompletions = habits.reduce((acc, h) => acc + h.completedDays.length, 0);
  const bestHabit = [...habits].sort((a, b) => b.completedDays.length - a.completedDays.length)[0];

  return (
    <div className="pb-32">
      <header className="px-4 pt-6 pb-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Thống kê</h1>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                timeRange === range ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {range === 'week' ? 'Tuần' : range === 'month' ? 'Tháng' : 'Năm'}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-md shadow-indigo-100">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-indigo-100 text-[9px] font-bold uppercase tracking-wider mb-0.5">Tổng cộng</p>
            <h3 className="text-xl font-black">{totalCompletions}</h3>
          </div>
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-2">
              <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Tốt nhất</p>
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{bestHabit?.name || '---'}</h3>
          </div>
        </div>

        {/* Habit Grids */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chi tiết thói quen</h3>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
              Nhấn thẻ để xem phân tích 21 ngày ✨
            </span>
          </div>
          
          {habits.map((habit, index) => (
            <div 
              key={habit.id} 
              onClick={() => handleOpen21Days(habit)}
              className="bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all duration-200 backdrop-blur-md rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 group"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {habit.name}
                    </h4>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold uppercase border ${categoryColors[habit.category] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                      {categoryIcons[habit.category] || <Sun className="w-2.5 h-2.5" />}
                      {habit.category}
                    </span>
                    <span className="text-[9px] font-semibold text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Xem phân tích 21 ngày →
                    </span>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{habit.completedDays.length}</span>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ngày</p>
                </div>
              </div>

              <div className={`grid gap-1 ${
                timeRange === 'week' ? 'grid-cols-7' : 
                timeRange === 'month' ? 'grid-cols-[repeat(auto-fill,minmax(18px,1fr))]' : 
                'grid-cols-[repeat(auto-fill,minmax(10px,1fr))]'
              }`}>
                {timeRangeDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isCompleted = habit.completedDays.includes(dateStr);
                  const isFuture = day > new Date();

                  return (
                    <div 
                      key={dateStr}
                      className={`aspect-square rounded-sm flex items-center justify-center transition-all ${
                        isFuture ? 'bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50' :
                        isCompleted ? 'bg-indigo-600 text-white shadow-sm' : 
                        'bg-slate-200/70 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500'
                      }`}
                      title={format(day, 'dd/MM/yyyy')}
                    >
                      {!isFuture && (
                        isCompleted ? <Check className="w-2 h-2 stroke-[4]" /> : <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {timeRange === 'week' && (
                <div className="grid grid-cols-7 gap-1 mt-2">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                    <span key={d} className="text-[8px] font-bold text-slate-400 dark:text-slate-500 text-center uppercase">{d}</span>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                    <Award className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chuỗi streak dài nhất</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white">{calculateLongestStreak(habit.completedDays)} ngày</span>
              </div>
            </div>
          ))}

          {habits.length === 0 && (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-slate-400 dark:text-slate-500 font-medium">Chưa có thói quen nào để thống kê</p>
            </div>
          )}
        </div>
      </div>

      {/* 21 Days Modal */}
      {selectedHabitFor21Days && (
        <Habit21DaysModal
          habit={selectedHabitFor21Days}
          categoryColors={categoryColors}
          categoryIcons={categoryIcons}
          onClose={handleClose21Days}
        />
      )}
    </div>
  );
};

const ProfilePage = ({ user, loginWithGoogle, loginWithFacebook, logout }: { user: User | null, loginWithGoogle: () => void, loginWithFacebook: () => void, logout: () => void }) => {
  return (
    <div className="pb-32">
      <header className="px-4 pt-6 pb-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Tài khoản</h1>
      </header>

      <div className="px-6 mt-8">
        {user ? (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`} 
                  alt="Avatar" 
                  className="w-24 h-24 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30 shadow-xl"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-slate-800 rounded-full" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{user.displayName}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium">{user.email}</p>
            </div>

            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">ID Người dùng</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[150px]">{user.uid}</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-50 dark:bg-slate-700" />

              <button 
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 py-4 rounded-2xl font-bold hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all active:scale-[0.98]"
              >
                <LogOut className="w-5 h-5" />
                Đăng xuất
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-12">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
              <UserIcon className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Chưa đăng nhập</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 px-8">Đăng nhập để đồng bộ thói quen của bạn trên tất cả các thiết bị.</p>
            <div className="flex flex-col gap-3 w-full px-8">
              <button 
                onClick={loginWithGoogle}
                className="flex items-center justify-center gap-3 bg-indigo-600 text-white w-full py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                <LogIn className="w-5 h-5" />
                Đăng nhập bằng Google
              </button>
              
              <button 
                onClick={loginWithFacebook}
                className="flex items-center justify-center gap-3 bg-[#1877F2] text-white w-full py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:bg-[#166fe5] transition-all active:scale-[0.98]"
              >
                <Facebook className="w-5 h-5 fill-current" />
                Đăng nhập bằng Facebook
              </button>
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">HabitFlow v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getFormattedDate(new Date()));
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('habit_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [categoryIconNames, setCategoryIconNames] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('habit_category_icons');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORY_ICON_NAMES;
  });
  const [categoryIcons, setCategoryIcons] = useState<Record<string, React.ReactNode>>(() => {
    const icons: Record<string, React.ReactNode> = {};
    Object.entries(categoryIconNames).forEach(([cat, iconName]) => {
      icons[cat] = getIconComponent(iconName as string);
    });
    return icons;
  });
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('habit_category_colors');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORY_COLORS;
  });
  
  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('habits');
    const savedIcons = localStorage.getItem('habit_category_icons');
    const iconNames = savedIcons ? JSON.parse(savedIcons) : DEFAULT_CATEGORY_ICON_NAMES;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((h: any) => ({
          ...h,
          icon: getIconComponent(iconNames[h.category] || 'sun')
        }));
      } catch (e) {
        console.error("Failed to parse habits", e);
      }
    }
    return getInitialHabits();
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (!currentUser) {
        // Clear states and local storage on logout to ensure privacy
        setHabits(getInitialHabits());
        setCategories(DEFAULT_CATEGORIES);
        setCategoryColors(DEFAULT_CATEGORY_COLORS);
        setCategoryIconNames(DEFAULT_CATEGORY_ICON_NAMES);
        
        const icons: Record<string, React.ReactNode> = {};
        Object.entries(DEFAULT_CATEGORY_ICON_NAMES).forEach(([cat, iconName]) => {
          icons[cat] = getIconComponent(iconName);
        });
        setCategoryIcons(icons);
        
        localStorage.removeItem('habits');
        localStorage.removeItem('habit_categories');
        localStorage.removeItem('habit_category_colors');
        localStorage.removeItem('habit_category_icons');
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Categories with Firestore
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.categories) setCategories(data.categories);
        if (data.categoryColors) setCategoryColors(data.categoryColors);
        if (data.categoryIcons) {
          setCategoryIconNames(data.categoryIcons);
          const icons: Record<string, React.ReactNode> = {};
          Object.entries(data.categoryIcons).forEach(([cat, iconName]) => {
            icons[cat] = getIconComponent(iconName as string);
          });
          setCategoryIcons(icons);
        }
      } else {
        // Initialize user profile if it doesn't exist
        setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          categories: DEFAULT_CATEGORIES,
          categoryColors: DEFAULT_CATEGORY_COLORS,
          categoryIcons: {
            'Sức khỏe': 'dumbbell',
            'Học tập': 'book',
            'Công việc': 'briefcase',
            'Cá nhân': 'heart'
          }
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`));
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Habits with Firestore
  useEffect(() => {
    if (!user) return;

    const habitsRef = collection(db, 'users', user.uid, 'habits');
    const unsubscribe = onSnapshot(habitsRef, (snapshot) => {
      const habitsData: Habit[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          icon: getIconComponent(data.iconName || 'sun')
        } as Habit;
      });
      setHabits(habitsData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/habits`));

    return () => unsubscribe();
  }, [user]);

  // Persistence Effects (Local Storage as fallback/cache)
  useEffect(() => {
    if (habits.length > 0) {
      const toSave = habits.map(({ icon, ...h }) => h);
      localStorage.setItem('habits', JSON.stringify(toSave));
    }
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('habit_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('habit_category_colors', JSON.stringify(categoryColors));
  }, [categoryColors]);

  useEffect(() => {
    const iconNames: Record<string, string> = {};
    // We only need to save icons for custom categories or if they changed
    // For simplicity, we'll try to map back JSX to names if we can, 
    // but since they are React nodes, it's hard.
    // Let's just store a mapping of category -> iconName string in a separate state or just use a convention.
  }, [categoryIcons]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  const editCategory = async (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    if (categories.includes(newName)) {
      alert('Tên phân loại đã tồn tại');
      return;
    }

    const updatedCategories = categories.map(c => c === oldName ? newName : c);
    setCategories(updatedCategories);

    // Update category colors and icons
    const updatedColors = { ...categoryColors };
    if (updatedColors[oldName]) {
      updatedColors[newName] = updatedColors[oldName];
      delete updatedColors[oldName];
      setCategoryColors(updatedColors);
    }

    const updatedIcons = { ...categoryIcons };
    const updatedIconNames = { ...categoryIconNames };
    if (updatedIconNames[oldName]) {
      updatedIconNames[newName] = updatedIconNames[oldName];
      delete updatedIconNames[oldName];
      setCategoryIconNames(updatedIconNames);
      
      updatedIcons[newName] = getIconComponent(updatedIconNames[newName]);
      delete updatedIcons[oldName];
      setCategoryIcons(updatedIcons);
    }

    // Update habits belonging to this category
    const batch = writeBatch(db);
    const updatedHabits = habits.map(habit => {
      if (habit.category === oldName) {
        const updatedHabit = { ...habit, category: newName };
        if (user) {
          const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
          batch.set(habitRef, { category: newName }, { merge: true });
        }
        return updatedHabit;
      }
      return habit;
    });
    setHabits(updatedHabits);

    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      batch.set(userDocRef, { 
        categories: updatedCategories,
        categoryColors: updatedColors,
        categoryIcons: updatedIconNames,
      }, { merge: true });
      await batch.commit().catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`));
    }
    
    // Update local storage
    localStorage.setItem('habit_category_icons', JSON.stringify(updatedIconNames));
    localStorage.setItem('habit_category_colors', JSON.stringify(updatedColors));
    localStorage.setItem('habit_categories', JSON.stringify(updatedCategories));
  };

  const deleteCategory = async (catName: string) => {
    if (catName === 'Tất cả') return;
    if (!confirm(`Bạn có chắc muốn xóa phân loại "${catName}"? Các thói quen thuộc phân loại này sẽ được chuyển về "Cá nhân".`)) return;

    const updatedCategories = categories.filter(c => c !== catName);
    setCategories(updatedCategories);

    const updatedColors = { ...categoryColors };
    delete updatedColors[catName];
    setCategoryColors(updatedColors);

    const updatedIconNames = { ...categoryIconNames };
    delete updatedIconNames[catName];
    setCategoryIconNames(updatedIconNames);

    const updatedIcons = { ...categoryIcons };
    delete updatedIcons[catName];
    setCategoryIcons(updatedIcons);

    // Update habits belonging to this category
    const batch = writeBatch(db);
    const updatedHabits = habits.map(habit => {
      if (habit.category === catName) {
        const updatedHabit = { ...habit, category: 'Cá nhân' };
        if (user) {
          const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
          batch.set(habitRef, { category: 'Cá nhân' }, { merge: true });
        }
        return updatedHabit;
      }
      return habit;
    });
    setHabits(updatedHabits);

    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      batch.set(userDocRef, { 
        categories: updatedCategories,
        categoryColors: updatedColors,
        categoryIcons: updatedIconNames
      }, { merge: true });
      await batch.commit().catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`));
    }

    // Update local storage
    localStorage.setItem('habit_category_icons', JSON.stringify(updatedIconNames));
    localStorage.setItem('habit_category_colors', JSON.stringify(updatedColors));
    localStorage.setItem('habit_categories', JSON.stringify(updatedCategories));
  };

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);
  const [selectedHabitForDetail, setSelectedHabitForDetail] = useState<Habit | null>(null);
  const [is21DaysModalOpen, setIs21DaysModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToEdit, setCategoryToEdit] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const handleStartEditCategory = (cat: string) => {
    setCategoryToEdit(cat);
    setEditCategoryName(cat);
    setIsEditingCategory(true);
  };

  const handleSaveCategoryEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryToEdit && editCategoryName) {
      editCategory(categoryToEdit, editCategoryName);
      setIsEditingCategory(false);
      setCategoryToEdit(null);
    }
  };
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitCategory, setNewHabitCategory] = useState<string>('Sức khỏe');
  const [newHabitTargetCount, setNewHabitTargetCount] = useState(1);
  const [currentView, setCurrentView] = useState<'home' | 'stats' | 'profile' | 'settings'>('home');

  const weekDays = useMemo(() => getWeekDays(), []);

  const filteredHabits = useMemo(() => {
    return habits.filter(h => selectedCategory === 'Tất cả' || h.category === selectedCategory);
  }, [habits, selectedCategory]);

  const toggleHabit = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const currentLog = habit.logs[selectedDate] || { date: selectedDate, count: 0 };
    const target = habit.targetCount || 1;
    
    let newCount = 0;
    let newCompletedDays = [...habit.completedDays];

    if (target === 1) {
      const isCompleted = habit.completedDays.includes(selectedDate);
      newCount = isCompleted ? 0 : 1;
      newCompletedDays = isCompleted 
        ? habit.completedDays.filter(d => d !== selectedDate)
        : [...habit.completedDays, selectedDate];
    } else {
      newCount = (currentLog.count || 0) + 1;
      const isNowCompleted = newCount >= target;
      const wasCompleted = habit.completedDays.includes(selectedDate);
      
      if (isNowCompleted && !wasCompleted) {
        newCompletedDays = [...habit.completedDays, selectedDate];
      } else if (!isNowCompleted && wasCompleted) {
        newCompletedDays = habit.completedDays.filter(d => d !== selectedDate);
      }
    }

    const updates = {
      completedDays: newCompletedDays,
      logs: {
        ...habit.logs,
        [selectedDate]: { ...currentLog, count: newCount }
      }
    };

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'habits', habitId), updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/habits/${habitId}`);
      }
    } else {
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, ...updates } : h));
    }
  };

  const updateHabitCount = (habitId: string, date: string, delta: number) => {
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        const currentLog = h.logs[date] || { date, count: 0 };
        const target = h.targetCount || 1;
        const newCount = Math.max(0, (currentLog.count || 0) + delta);
        const isNowCompleted = newCount >= target;
        const wasCompleted = h.completedDays.includes(date);
        
        let newCompletedDays = h.completedDays;
        if (isNowCompleted && !wasCompleted) {
          newCompletedDays = [...h.completedDays, date];
        } else if (!isNowCompleted && wasCompleted) {
          newCompletedDays = h.completedDays.filter(d => d !== date);
        }

        return {
          ...h,
          completedDays: newCompletedDays,
          logs: {
            ...h.logs,
            [date]: { ...currentLog, count: newCount }
          }
        };
      }
      return h;
    }));
  };

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const habitId = Date.now().toString();
    const iconName = 'sun'; // Default or mapped from category
    
    const newHabitData = {
      id: habitId,
      name: newHabitName,
      category: newHabitCategory,
      iconName: iconName,
      completedDays: [],
      logs: {},
      color: 'indigo',
      targetCount: newHabitTargetCount,
      createdAt: new Date().toISOString()
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'habits', habitId), {
          ...newHabitData,
          userId: user.uid
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/habits/${habitId}`);
      }
    } else {
      setHabits([...habits, { ...newHabitData, icon: getIconComponent(iconName) } as Habit]);
    }

    setNewHabitName('');
    setNewHabitTargetCount(1);
    setIsAdding(false);
  };

  const startEditing = (habit: Habit) => {
    setHabitToEdit(habit);
    setNewHabitName(habit.name);
    setNewHabitCategory(habit.category);
    setNewHabitTargetCount(habit.targetCount);
    setIsEditing(true);
  };

  const saveEditedHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitToEdit || !newHabitName.trim()) return;

    const updates = {
      name: newHabitName,
      category: newHabitCategory,
      targetCount: newHabitTargetCount,
      updatedAt: new Date().toISOString()
    };

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'habits', habitToEdit.id), updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/habits/${habitToEdit.id}`);
      }
    } else {
      setHabits(prev => prev.map(h => h.id === habitToEdit.id ? { ...h, ...updates } : h));
    }

    setHabitToEdit(null);
    setNewHabitName('');
    setNewHabitTargetCount(1);
    setIsEditing(false);
  };

  const deleteHabit = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'habits', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/habits/${id}`);
      }
    } else {
      setHabits(habits.filter(h => h.id !== id));
    }
  };

  const updateHabitLog = async (habitId: string, date: string, updates: Partial<HabitLog>) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const currentLog: HabitLog = habit.logs[date] || { date, count: 0 };
    const newLogs: Record<string, HabitLog> = {
      ...habit.logs,
      [date]: { ...currentLog, ...updates }
    };

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'habits', habitId), { logs: newLogs });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/habits/${habitId}`);
      }
    } else {
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, logs: newLogs } : h));
    }
  };

  const handleImageUpload = (habitId: string, date: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      updateHabitLog(habitId, date, { imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || categories.includes(newCategoryName)) return;

    const updatedCategories = [...categories, newCategoryName];
    setCategories(updatedCategories);
    
    const defaultIcon = 'sun';
    const defaultColor = 'bg-slate-100 text-slate-700 border-slate-200';

    setCategoryIconNames(prev => ({
      ...prev,
      [newCategoryName]: defaultIcon
    }));

    setCategoryIcons(prev => ({
      ...prev,
      [newCategoryName]: getIconComponent(defaultIcon)
    }));

    setCategoryColors(prev => ({
      ...prev,
      [newCategoryName]: defaultColor
    }));

    // Update icon names persistence locally
    const savedIconNames = localStorage.getItem('habit_category_icons');
    const iconNames = savedIconNames ? JSON.parse(savedIconNames) : {};
    iconNames[newCategoryName] = defaultIcon;
    localStorage.setItem('habit_category_icons', JSON.stringify(iconNames));

    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        categories: updatedCategories,
        [`categoryIcons.${newCategoryName}`]: defaultIcon,
        [`categoryColors.${newCategoryName}`]: defaultColor
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`));
    }

    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const progress = useMemo(() => {
    if (habits.length === 0) return 0;
    
    const totalProgress = habits.reduce((acc, habit) => {
      const log = habit.logs[selectedDate];
      const current = log?.count || 0;
      const target = habit.targetCount || 1;
      // If it's a simple check habit, use completedDays for consistency
      if (target === 1) {
        return acc + (habit.completedDays.includes(selectedDate) ? 1 : 0);
      }
      return acc + Math.min(current / target, 1);
    }, 0);
    
    return Math.round((totalProgress / habits.length) * 100);
  }, [habits, selectedDate]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30 pb-24 transition-colors duration-300">
      {currentView === 'home' ? (
        <>
          {/* Header */}
          <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 pt-6 pb-3 sticky top-0 z-30 shadow-sm border-b border-slate-100 dark:border-slate-800">
            {/* Day Selector */}
            <div className="flex justify-between items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {weekDays.map((date, idx) => {
                const dateStr = getFormattedDate(date);
                const isActive = selectedDate === dateStr;
                const isToday = dateStr === getFormattedDate(new Date());
                
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex flex-col items-center justify-center min-w-[42px] h-12 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase mb-0.5">{DAYS_OF_WEEK[idx]}</span>
                    <span className="text-sm font-bold">{date.getDate()}</span>
                    {isToday && !isActive && (
                      <div className="w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </header>

          <main className="px-4 mt-4">
            {/* Progress Card */}
            <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-100 dark:shadow-none mb-4 relative overflow-hidden">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold mb-0.5">Tiến độ hôm nay</h2>
                  <p className="text-indigo-100 text-[11px]">Bạn đã hoàn thành {progress}%</p>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-indigo-400/20 flex items-center justify-center relative">
                  <span className="text-[10px] font-bold">{progress}%</span>
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray="125.66"
                      strokeDashoffset={125.66 - (125.66 * progress) / 100}
                      strokeLinecap="round"
                      className="text-white transition-all duration-700 ease-in-out"
                    />
                  </svg>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            </div>

            {/* Categories */}
            <div className="mb-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map(cat => {
                  const isSelected = selectedCategory === cat;
                  const colorClass = categoryColors[cat] || 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                  
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border backdrop-blur-sm ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 dark:shadow-none'
                          : `${colorClass} hover:border-slate-300 dark:hover:border-slate-600`
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {categoryIcons[cat]}
                        {cat}
                      </div>
                    </button>
                  );
                })}
                <button 
                  onClick={() => setIsAddingCategory(true)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-100 dark:shadow-none"
                  title="Thêm phân loại"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </div>

            {/* Habit List */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thói quen</h3>
                <span className="text-[10px] text-slate-400 font-medium">{filteredHabits.length} mục</span>
              </div>
              
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredHabits.map((habit, index) => {
                    const isCompleted = habit.completedDays.includes(selectedDate);
                    return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={habit.id}
                          className={`habit-card group cursor-pointer transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40' 
                              : 'bg-white/85 dark:bg-slate-800/85 border-slate-100 dark:border-slate-700/60 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800/50'
                          }`}
                          onClick={() => setSelectedHabitForDetail(habit)}
                        >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-sm font-black ${
                              isCompleted ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <h4 className={`text-sm font-medium transition-all ${
                                isCompleted ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'
                              }`}>
                                {habit.name}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${categoryColors[habit.category] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                                  {categoryIcons[habit.category] || <Sun className="w-2.5 h-2.5" />}
                                  {habit.category}
                                </div>
                                {habit.logs[selectedDate]?.note && (
                                  <div className="w-1 h-1 bg-indigo-400 rounded-full" title="Có ghi chú" />
                                )}
                                {habit.logs[selectedDate]?.imageUrl && (
                                  <div className="w-1 h-1 bg-emerald-400 rounded-full" title="Có hình ảnh" />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {habit.targetCount > 1 && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateHabitCount(habit.id, selectedDate, -1);
                                }}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors bg-slate-100/50 dark:bg-slate-800/50 rounded-lg md:bg-transparent md:dark:bg-transparent md:opacity-0 md:group-hover:opacity-100"
                                title="Giảm"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(habit);
                              }}
                              className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl md:opacity-0 md:group-hover:opacity-100 transition-all"
                              title="Chỉnh sửa"
                            >
                              <Pencil className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteHabit(habit.id);
                              }}
                              className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl md:opacity-0 md:group-hover:opacity-100 transition-all"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHabit(habit.id);
                              }}
                              className="transition-all ml-1"
                            >
                              {habit.targetCount > 1 ? (
                                <ProgressCircle 
                                  current={habit.logs[selectedDate]?.count || 0} 
                                  target={habit.targetCount} 
                                  size={32}
                                />
                              ) : (
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border-2 ${
                                  isCompleted 
                                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-transparent hover:border-indigo-400'
                                }`}>
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {filteredHabits.length === 0 && (
                  <div className="text-center py-10 px-4 bg-white/50 dark:bg-slate-800/40 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600 dark:text-indigo-400">
                      <Sun className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                      {selectedCategory === 'Tất cả' ? 'Chưa có thói quen nào' : `Chưa có thói quen mục "${selectedCategory}"`}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
                      Tạo thói quen đầu tiên của bạn để bắt đầu theo dõi và duy trì động lực mỗi ngày!
                    </p>
                    <button
                      onClick={() => setIsAdding(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      Thêm thói quen mới
                    </button>
                  </div>
                )}
              </div>
            </div>
          </main>
        </>
      ) : currentView === 'stats' ? (
        <StatsPage 
          habits={habits} 
          categoryColors={categoryColors} 
          categoryIcons={categoryIcons} 
          onModalToggle={setIs21DaysModalOpen}
        />
      ) : currentView === 'profile' ? (
        <ProfilePage 
          user={user} 
          loginWithGoogle={loginWithGoogle} 
          loginWithFacebook={loginWithFacebook}
          logout={logout} 
        />
      ) : (
        <div className="pb-32">
          <header className="px-4 pt-6 pb-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 shadow-sm border-b border-slate-100 dark:border-slate-800">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Cài đặt</h1>
          </header>

          <div className="px-6 mt-8 space-y-6">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <Bell className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">Thông báo</span>
                </div>
                <div className="w-10 h-5 bg-slate-200 dark:bg-slate-600 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                </div>
              </div>

              <div className="h-px bg-slate-50 dark:bg-slate-700" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <Moon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">Chế độ tối</span>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}
                >
                  <motion.div 
                    animate={{ x: darkMode ? 20 : 0 }}
                    className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm" 
                  />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Hỗ trợ</h3>
              <button className="w-full flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="font-medium">Điều khoản sử dụng</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="h-px bg-slate-50 dark:bg-slate-700" />
              <button className="w-full flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="font-medium">Chính sách bảo mật</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 px-2 py-3 flex justify-around items-center z-40">
        <button 
          onClick={() => setCurrentView('home')}
          className={`flex flex-col items-center gap-1 transition-all flex-1 ${currentView === 'home' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <Home className={`w-5 h-5 ${currentView === 'home' ? 'fill-indigo-50 dark:fill-indigo-900/30' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-wider">Trang chủ</span>
        </button>
        
        <button 
          onClick={() => setCurrentView('stats')}
          className={`flex flex-col items-center gap-1 transition-all flex-1 ${currentView === 'stats' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <BarChart2 className={`w-5 h-5 ${currentView === 'stats' ? 'fill-indigo-50 dark:fill-indigo-900/30' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-wider">Thống kê</span>
        </button>

        {/* Center FAB Spacer */}
        <div className="flex-1 flex justify-center">
          <div className="w-12 h-12" />
        </div>

        <button 
          onClick={() => setCurrentView('profile')}
          className={`flex flex-col items-center gap-1 transition-all flex-1 ${currentView === 'profile' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <UserIcon className={`w-5 h-5 ${currentView === 'profile' ? 'fill-indigo-50 dark:fill-indigo-900/30' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-wider">Tài khoản</span>
        </button>

        <button 
          onClick={() => setCurrentView('settings')}
          className={`flex flex-col items-center gap-1 transition-all flex-1 ${currentView === 'settings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <Settings className={`w-5 h-5 ${currentView === 'settings' ? 'fill-indigo-50 dark:fill-indigo-900/30' : ''}`} />
          <span className="text-[8px] font-bold uppercase tracking-wider">Cài đặt</span>
        </button>
      </div>

      {/* Floating Action Button - Centered */}
      {!isAdding && !isEditing && !selectedHabitForDetail && !isAddingCategory && !is21DaysModalOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button 
            onClick={() => setIsAdding(true)}
            className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 dark:shadow-none border-4 border-white dark:border-slate-800 active:scale-90 transition-all"
          >
            <Plus className="w-7 h-7 stroke-[3]" />
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      {/* (Moved to Bottom Navigation) */}

      {/* Add Habit Modal */}
      <AnimatePresence>
        {isAdding && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-[32px] p-6 z-40 shadow-2xl"
            >
              <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Thêm thói quen mới</h2>
              
              <form onSubmit={addHabit}>
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tên thói quen</label>
                  <input
                    autoFocus
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="Ví dụ: Chạy bộ, Học tiếng Anh..."
                    className="w-full bg-slate-50 dark:bg-slate-700 border-none rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phân loại</label>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(true);
                        setIsEditingCategory(false);
                        setNewCategoryName('');
                      }}
                      className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      Quản lý
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {categories.filter(c => c !== 'Tất cả').map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewHabitCategory(cat)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          newHabitCategory === cat
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-400'
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          newHabitCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {categoryIcons[cat] || <Sun className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-bold text-xs truncate">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Mục tiêu mỗi ngày</label>
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700 p-3 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setNewHabitTargetCount(Math.max(1, newHabitTargetCount - 1))}
                      className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">{newHabitTargetCount}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase ml-1.5">lần</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewHabitTargetCount(newHabitTargetCount + 1)}
                      className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-bold text-base shadow-md shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-[0.98]"
                >
                  Tạo thói quen
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Habit Modal */}
      <AnimatePresence>
        {isEditing && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-[32px] p-6 z-40 shadow-2xl"
            >
              <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Chỉnh sửa thói quen</h2>
              
              <form onSubmit={saveEditedHabit}>
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tên thói quen</label>
                  <input
                    autoFocus
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="Ví dụ: Chạy bộ, Học tiếng Anh..."
                    className="w-full bg-slate-50 dark:bg-slate-700 border-none rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phân loại</label>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(true);
                        setIsEditingCategory(false);
                        setNewCategoryName('');
                      }}
                      className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      Quản lý
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {categories.filter(c => c !== 'Tất cả').map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewHabitCategory(cat)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          newHabitCategory === cat
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-400'
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          newHabitCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {categoryIcons[cat] || <Sun className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-bold text-xs truncate">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Mục tiêu mỗi ngày</label>
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700 p-3 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setNewHabitTargetCount(Math.max(1, newHabitTargetCount - 1))}
                      className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">{newHabitTargetCount}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase ml-1.5">lần</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewHabitTargetCount(newHabitTargetCount + 1)}
                      className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl py-3 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-indigo-600 text-white rounded-xl py-3 font-bold text-sm shadow-md shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-[0.98]"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Manage Categories Modal */}
      <AnimatePresence>
        {isAddingCategory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingCategory(false);
                setIsEditingCategory(false);
                setCategoryToEdit(null);
              }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-[32px] p-5 z-[60] shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 shrink-0" />
              
              <div className="flex-1 overflow-y-auto pr-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 uppercase text-center">
                  {isEditingCategory ? 'Chỉnh sửa phân loại' : 'Quản lý phân loại'}
                </h2>
                
                {/* Add/Edit Form */}
                <form 
                  onSubmit={(e) => {
                    if (isEditingCategory) {
                      handleSaveCategoryEdit(e);
                    } else {
                      addCategory(e);
                    }
                  }}
                  className="mb-5 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700"
                >
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {isEditingCategory ? 'Tên phân loại mới' : 'Thêm phân loại mới'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={isEditingCategory ? editCategoryName : newCategoryName}
                      onChange={(e) => isEditingCategory ? setEditCategoryName(e.target.value) : setNewCategoryName(e.target.value)}
                      placeholder="Ví dụ: Tài chính..."
                      className="flex-1 bg-white dark:bg-slate-800 border-none rounded-xl p-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      {isEditingCategory ? 'Lưu' : 'Thêm'}
                    </button>
                    {isEditingCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingCategory(false);
                          setCategoryToEdit(null);
                        }}
                        className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </form>

                {/* Categories List */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Danh sách phân loại</h3>
                  <div className="space-y-1.5">
                    {categories.filter(c => c !== 'Tất cả').map(cat => (
                      <div key={cat} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 group">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryColors[cat] || 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {categoryIcons[cat] || <Sun className="w-3.5 h-3.5" />}
                          </div>
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{cat}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button 
                            onClick={() => handleStartEditCategory(cat)}
                            className="p-1.5 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-all"
                            title="Sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                          <button 
                            onClick={() => deleteCategory(cat)}
                            className="p-1.5 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
                <button
                  onClick={() => {
                    setIsAddingCategory(false);
                    setIsEditingCategory(false);
                    setCategoryToEdit(null);
                  }}
                  className="w-full bg-slate-900 dark:bg-slate-700 text-white rounded-xl py-3 font-bold text-sm transition-all active:scale-[0.98]"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Habit Detail Modal */}
      <AnimatePresence>
        {selectedHabitForDetail && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHabitForDetail(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-[5%] bottom-[5%] bg-white dark:bg-slate-800 rounded-[32px] z-40 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none text-sm font-black`}>
                      {habits.findIndex(h => h.id === selectedHabitForDetail.id) !== -1 
                        ? habits.findIndex(h => h.id === selectedHabitForDetail.id) + 1 
                        : 1}
                    </div>
                    <div>
                      <h2 className="text-base font-medium text-slate-800 dark:text-slate-100 leading-tight">{selectedHabitForDetail.name}</h2>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8.5px] font-bold uppercase mt-1 border ${categoryColors[selectedHabitForDetail.category] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                        {categoryIcons[selectedHabitForDetail.category] || <Sun className="w-3 h-3" />}
                        {selectedHabitForDetail.category}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedHabitForDetail(null)}
                    className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Count Section */}
                  {selectedHabitForDetail.targetCount > 1 && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <h3 className="text-[9px] font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Tiến độ</h3>
                        </div>
                        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          Mục tiêu: {selectedHabitForDetail.targetCount}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2">
                        <button 
                          onClick={() => updateHabitCount(selectedHabitForDetail.id, selectedDate, -1)}
                          className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        
                        <div className="flex flex-col items-center">
                          <ProgressCircle 
                            current={habits.find(h => h.id === selectedHabitForDetail.id)?.logs[selectedDate]?.count || 0} 
                            target={selectedHabitForDetail.targetCount}
                            size={60}
                          />
                        </div>

                        <button 
                          onClick={() => updateHabitCount(selectedHabitForDetail.id, selectedDate, 1)}
                          className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Note Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <StickyNote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ghi chú</h3>
                    </div>
                    <textarea
                      value={habits.find(h => h.id === selectedHabitForDetail.id)?.logs[selectedDate]?.note || ''}
                      onChange={(e) => updateHabitLog(selectedHabitForDetail.id, selectedDate, { note: e.target.value })}
                      placeholder="Ghi chú..."
                      className="w-full bg-slate-50 dark:bg-slate-700 border-none rounded-xl p-3 text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 transition-all font-medium min-h-[80px] resize-none"
                    />
                  </div>

                  {/* Image Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hình ảnh</h3>
                    </div>
                    
                    {habits.find(h => h.id === selectedHabitForDetail.id)?.logs[selectedDate]?.imageUrl ? (
                      <div className="relative group rounded-2xl overflow-hidden aspect-video bg-slate-100 dark:bg-slate-700">
                        <img 
                          src={habits.find(h => h.id === selectedHabitForDetail.id)?.logs[selectedDate]?.imageUrl} 
                          alt="Habit proof" 
                          className="w-full h-full object-cover"
                        />
                        <button 
                          onClick={() => updateHabitLog(selectedHabitForDetail.id, selectedDate, { imageUrl: undefined })}
                          className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full aspect-video bg-slate-50 dark:bg-slate-700 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-all group">
                        <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2" />
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Tải lên hình ảnh</p>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(selectedHabitForDetail.id, selectedDate, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setSelectedHabitForDetail(null)}
                  className="w-full bg-slate-900 dark:bg-indigo-600 text-white rounded-xl py-2.5 font-bold text-sm shadow-md shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all active:scale-[0.98]"
                >
                  Xong
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
