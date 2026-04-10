import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Plus, Camera, Image as ImageIcon, Check, 
  PieChart, BarChart2, Type, ChevronDown, Trash2, 
  Settings, HelpCircle, Layout, Type as TypeIcon, 
  LogOut, Pencil, Maximize
} from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// --- Types ---
type ChartType = 'pie' | 'bar' | 'text';

type WidgetType = {
  id: string;
  title: string;
  icon: React.ReactNode;
};

type ActiveWidget = {
  id: string;
  w: number;
  h: number;
};

// --- Mock Data & Constants ---
const WIDGET_OPTIONS: WidgetType[] = [
  { id: 'balance_year', title: '올해잔액', icon: <PieChart size={24} /> },
  { id: 'monthly_trend', title: '월별추이', icon: <BarChart2 size={24} /> },
  { id: 'weekly_chart', title: '이번주 지출 차트', icon: <BarChart2 size={24} /> },
  { id: 'status_msg', title: '상태메시지', icon: <Type size={24} /> },
  { id: 'recent_use', title: '최근사용', icon: <Type size={24} /> },
  { id: 'calendar', title: '달력 (주별 활동사진)', icon: <Layout size={24} /> },
  { id: 'ai_advice', title: '계획 조언 AI', icon: <HelpCircle size={24} /> },
  { id: 'supporter_comment', title: '지원자 코멘트', icon: <TypeIcon size={24} /> },
];

// --- Sub-components ---

// Pizza Pie Chart
const PizzaChart = ({ totalBudget, remaining }: { totalBudget: number, remaining: number }) => {
  const percent = Math.max(0, Math.min(1, remaining / totalBudget));
  const circumference = 2 * Math.PI * 25; // 157.08
  const offset = circumference - (circumference * percent);

  return (
    <div className="w-48 h-48 relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 filter drop-shadow-md">
        {/* Empty plate/pan */}
        <circle cx="50" cy="50" r="48" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="2" />
        <circle cx="50" cy="50" r="42" fill="#f3f4f6" />
        
        {/* Mask for Pizza Slices */}
        <mask id="pizza-mask">
          <circle 
            cx="50" cy="50" r="25" 
            fill="none" stroke="white" strokeWidth="50"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out" 
          />
        </mask>
        
        {/* The Pizza */}
        <g mask="url(#pizza-mask)">
          <circle cx="50" cy="50" r="44" fill="#d97706" /> {/* Crust */}
          <circle cx="50" cy="50" r="38" fill="#facc15" /> {/* Cheese */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="2" /> {/* Sauce Edge */}
          
          {/* Pepperonis */}
          <circle cx="30" cy="35" r="5" fill="#ef4444" />
          <circle cx="70" cy="30" r="6" fill="#ef4444" />
          <circle cx="50" cy="20" r="5.5" fill="#ef4444" />
          <circle cx="55" cy="70" r="6" fill="#ef4444" />
          <circle cx="35" cy="65" r="5" fill="#ef4444" />
          <circle cx="75" cy="55" r="5.5" fill="#ef4444" />
          <circle cx="50" cy="50" r="4.5" fill="#ef4444" />
          
          {/* Herbs */}
          <path d="M 40 40 Q 42 38 45 40 Q 42 42 40 40" fill="#22c55e" />
          <path d="M 60 60 Q 62 58 65 60 Q 62 62 60 60" fill="#22c55e" />
          <path d="M 30 50 Q 32 48 35 50 Q 32 52 30 50" fill="#22c55e" />
        </g>
      </svg>
      {/* Label Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm font-bold text-center border border-white/50">
          <span className="text-[10px] text-neutral-600 block leading-tight">남은 피자(잔액)</span>
          <span className="text-sm text-neutral-900 leading-tight">{remaining.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
};

// Water Cup Chart
const WaterCupChart = ({ totalBudget, remaining }: { totalBudget: number, remaining: number }) => {
  const percent = Math.max(0, Math.min(1, remaining / totalBudget));

  return (
    <div className="flex flex-col items-center justify-center w-full h-full pt-2 pb-6">
      <div className="relative w-32 h-40 rounded-b-[2rem] border-4 border-t-0 border-blue-200 bg-blue-50/40 overflow-hidden shadow-inner flex items-end justify-center z-10">
        {/* Water Level */}
        <div 
          className="w-full bg-blue-500 transition-all duration-700 ease-out relative"
          style={{ height: `${percent * 100}%` }}
        >
          {/* Waves / Water surface effect */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-blue-400/50 -translate-y-1/2 rounded-[50%]" />
          <div className="absolute top-0 left-3 right-3 h-2 bg-white/30 -translate-y-1/2 rounded-[50%]" />
        </div>
        
        {/* Cup Measurements */}
        <div className="absolute bottom-1/4 left-0 w-3 h-1 bg-blue-200/80 rounded-r-sm" />
        <div className="absolute bottom-2/4 left-0 w-5 h-1 bg-blue-200/80 rounded-r-sm" />
        <div className="absolute bottom-3/4 left-0 w-3 h-1 bg-blue-200/80 rounded-r-sm" />
      </div>
      
      <div className="mt-4 text-center">
        <span className="text-xs font-medium text-neutral-500">남은 물 (예산)</span>
        <span className="text-xl font-bold text-blue-600 block leading-tight mt-0.5">{remaining.toLocaleString()}원</span>
      </div>
    </div>
  );
};

// Draggable Widget Component
const DraggableWidget = ({ 
  widgetData, index, isEditMode, 
  moveWidget, removeWidget, toggleSize 
}: { 
  widgetData: ActiveWidget, index: number, isEditMode: boolean, 
  moveWidget: (dragIndex: number, hoverIndex: number) => void,
  removeWidget: (id: string) => void,
  toggleSize: (id: string) => void
}) => {
  const widget = WIDGET_OPTIONS.find(w => w.id === widgetData.id);
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop({
    accept: 'WIDGET',
    drop(item: { id: string, index: number }) {
      if (item.index !== index) {
        moveWidget(item.index, index);
        item.index = index;
      }
    },
    collect: monitor => ({
      isOver: monitor.isOver()
    })
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'WIDGET',
    item: () => ({ id: widgetData.id, index }),
    canDrag: isEditMode,
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  });

  drag(drop(ref));
  if (!widget) return null;

  const colSpan = widgetData.w === 2 ? 'col-span-2' : 'col-span-1';
  const rowSpan = widgetData.h === 2 ? 'row-span-2' : 'row-span-1';

  return (
    <div
      ref={ref}
      className={`${colSpan} ${rowSpan} relative ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          rotate: isEditMode && !isDragging ? [-1, 1, -1] : 0 
        }}
        transition={
          isEditMode && !isDragging
            ? { repeat: Infinity, duration: 0.3, ease: "linear" } 
            : { type: 'spring', stiffness: 300, damping: 25 }
        }
        className={`w-full h-full bg-white p-4 rounded-3xl shadow-sm border ${isOver ? 'border-blue-400 border-2' : 'border-neutral-100'} flex flex-col items-center justify-center gap-3 relative`}
      >
        {isEditMode && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); removeWidget(widgetData.id); }}
              className="absolute -top-2 -left-2 bg-red-500 text-white p-2 rounded-full shadow-md z-10 hover:bg-red-600 transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleSize(widgetData.id); }}
              className="absolute -top-2 -right-2 bg-neutral-700 text-white p-2 rounded-full shadow-md z-10 hover:bg-neutral-800 transition-colors"
              title="크기 변경"
            >
              <Maximize size={14} />
            </button>
          </>
        )}
        
        <div className={`${widgetData.h === 2 ? 'w-20 h-20' : 'w-14 h-14'} bg-blue-50 text-blue-500 rounded-full flex items-center justify-center transition-all`}>
          {widget.icon}
        </div>
        <span className={`font-medium text-center text-neutral-700 leading-tight ${widgetData.w === 2 && widgetData.h === 1 ? 'text-base' : 'text-sm'}`}>
          {widget.title}
        </span>
      </motion.div>
    </div>
  );
};


// --- Main App ---
export default function App() {
  const [title, setTitle] = useState('개인 예산 관리');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chartType, setChartType] = useState<ChartType>('pie');
  
  // Budget Data
  const [totalBudget, setTotalBudget] = useState(1000000); // 1,000,000 won
  const [spent, setSpent] = useState(350000); // 350,000 won
  
  // Widgets
  const [activeWidgets, setActiveWidgets] = useState<ActiveWidget[]>([
    { id: 'balance_year', w: 1, h: 1 },
    { id: 'monthly_trend', w: 1, h: 1 },
  ]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tempSelectedWidgets, setTempSelectedWidgets] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Computed
  const remaining = totalBudget - spent;

  const handleTitleSubmit = () => {
    if (titleInput.trim()) setTitle(titleInput);
    setIsEditingTitle(false);
  };

  const toggleWidgetSelection = (id: string) => {
    setTempSelectedWidgets(prev => 
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const confirmWidgets = () => {
    const newWidgets = tempSelectedWidgets.map(id => {
      const existing = activeWidgets.find(w => w.id === id);
      return existing ? existing : { id, w: 1, h: 1 };
    });
    setActiveWidgets(newWidgets);
    setIsAddModalOpen(false);
  };

  const removeWidget = (id: string) => {
    setActiveWidgets(prev => prev.filter(w => w.id !== id));
  };

  const moveWidget = (dragIndex: number, hoverIndex: number) => {
    setActiveWidgets(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, moved);
      return updated;
    });
  };

  const toggleSize = (id: string) => {
    setActiveWidgets(prev => prev.map(w => {
      if (w.id === id) {
        if (w.w === 1 && w.h === 1) return { ...w, w: 2, h: 1 };
        if (w.w === 2 && w.h === 1) return { ...w, w: 2, h: 2 };
        return { ...w, w: 1, h: 1 };
      }
      return w;
    }));
  };

  // Mock changes
  const simulateExpense = () => setSpent(prev => Math.min(prev + 100000, totalBudget));
  const simulateIncome = () => setSpent(prev => Math.max(prev - 100000, 0));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-neutral-100 flex justify-center text-neutral-800 font-sans">
        <div className="w-full max-w-md bg-white shadow-xl overflow-hidden relative flex flex-col h-[100dvh]">
          
          {/* --- Header --- */}
          <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white z-10">
            <div className="flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="text-2xl font-bold border-b-2 border-blue-500 outline-none w-full bg-transparent"
                    autoFocus
                    onBlur={handleTitleSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                  />
                  <button onClick={handleTitleSubmit} className="text-blue-500 p-1">
                    <Check size={20} />
                  </button>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => {
                    setTitleInput(title);
                    setIsEditingTitle(true);
                  }}
                >
                  <h1 className="text-2xl font-bold text-neutral-900 truncate">
                    {title}
                  </h1>
                  <Pencil size={16} className="text-neutral-400 group-hover:text-blue-500 transition-colors" />
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors ml-4"
            >
              <User size={24} className="text-neutral-600" />
            </button>
          </header>

          {/* --- Main Content Scrollable --- */}
          <div className="flex-1 overflow-y-auto px-4 pb-24">
            
            {/* Main Balance Section */}
            <motion.section 
              className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 mb-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">잔액 요약</h2>
                <div className="flex bg-neutral-100 rounded-lg p-1">
                  <button 
                    onClick={() => setChartType('pie')}
                    className={`p-1.5 rounded-md transition-colors ${chartType === 'pie' ? 'bg-white shadow-sm text-yellow-600' : 'text-neutral-400'}`}
                  >
                    <PieChart size={18} />
                  </button>
                  <button 
                    onClick={() => setChartType('bar')}
                    className={`p-1.5 rounded-md transition-colors ${chartType === 'bar' ? 'bg-white shadow-sm text-blue-500' : 'text-neutral-400'}`}
                  >
                    <BarChart2 size={18} />
                  </button>
                  <button 
                    onClick={() => setChartType('text')}
                    className={`p-1.5 rounded-md transition-colors ${chartType === 'text' ? 'bg-white shadow-sm text-neutral-700' : 'text-neutral-400'}`}
                  >
                    <Type size={18} />
                  </button>
                </div>
              </div>

              {/* Chart Area */}
              <div className="min-h-[220px] mb-6 flex items-center justify-center relative">
                <AnimatePresence mode="wait">
                  {chartType === 'pie' && (
                    <motion.div 
                      key="pie" 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="w-full flex items-center justify-center"
                    >
                      <PizzaChart totalBudget={totalBudget} remaining={remaining} />
                    </motion.div>
                  )}

                  {chartType === 'bar' && (
                    <motion.div 
                      key="bar"
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: -20 }}
                      className="w-full flex items-center justify-center h-full"
                    >
                      <WaterCupChart totalBudget={totalBudget} remaining={remaining} />
                    </motion.div>
                  )}

                  {chartType === 'text' && (
                    <motion.div 
                      key="text"
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full h-full flex flex-col items-center justify-center text-center space-y-4"
                    >
                      <div>
                        <p className="text-neutral-500 text-sm mb-1">총 예산</p>
                        <p className="text-lg font-medium">{totalBudget.toLocaleString()}원</p>
                      </div>
                      <div>
                        <p className="text-blue-500 text-sm mb-1">남은 금액</p>
                        <motion.p 
                          key={`remaining-${remaining}`}
                          initial={{ scale: 1.1 }} animate={{ scale: 1 }}
                          className="text-3xl font-bold text-blue-600"
                        >
                          {remaining.toLocaleString()}원
                        </motion.p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Simulation Buttons */}
              <div className="flex gap-2 mb-6 justify-center">
                 <button onClick={simulateIncome} className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100 hover:bg-green-100 font-medium">+ 예산 확보 (Test)</button>
                 <button onClick={simulateExpense} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-full border border-red-100 hover:bg-red-100 font-medium">- 지출 (Test)</button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button className="flex-1 py-3 px-4 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors font-medium">
                  <Camera size={20} />
                  <span>영수증</span>
                </button>
                <button className="flex-1 py-3 px-4 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors font-medium">
                  <ImageIcon size={20} />
                  <span>활동사진</span>
                </button>
              </div>

              <div className="mt-6 flex justify-center border-t border-dashed border-neutral-200 pt-4">
                <button className="text-neutral-400 hover:text-neutral-600 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium">더보기</span>
                  <ChevronDown size={16} />
                </button>
              </div>
            </motion.section>

            {/* Add Widget Button */}
            <motion.div className="mb-6 flex justify-center">
              <button 
                onClick={() => {
                  setTempSelectedWidgets(activeWidgets.map(w => w.id));
                  setIsAddModalOpen(true);
                }}
                className="w-full max-w-[200px] aspect-[3/1] rounded-3xl border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:border-blue-300 hover:text-blue-500 transition-all group"
              >
                <Plus size={28} className="group-hover:scale-110 transition-transform" />
              </button>
            </motion.div>

            {/* Widgets Grid Header */}
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-sm font-medium text-neutral-500 flex items-center gap-2">
                {activeWidgets.length > 0 ? "나의 위젯" : "위젯을 추가해보세요"}
                {isEditMode && <span className="text-[10px] bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">편집 모드</span>}
              </h3>
              {activeWidgets.length > 0 && (
                <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${isEditMode ? 'bg-blue-600 text-white font-medium' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                >
                  {isEditMode ? '완료' : '편집'}
                </button>
              )}
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-2 gap-4 auto-rows-[120px] grid-flow-row-dense">
              {activeWidgets.map((widgetData, index) => (
                <DraggableWidget
                  key={widgetData.id}
                  index={index}
                  widgetData={widgetData}
                  isEditMode={isEditMode}
                  moveWidget={moveWidget}
                  removeWidget={removeWidget}
                  toggleSize={toggleSize}
                />
              ))}
            </div>

          </div>

          {/* --- Modals / Overlays --- */}

          {/* Add Features Modal */}
          <AnimatePresence>
            {isAddModalOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 z-40"
                  onClick={() => setIsAddModalOpen(false)}
                />
                <motion.div 
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 z-50 max-h-[80vh] flex flex-col"
                >
                  <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-6" />
                  <h3 className="text-xl font-bold mb-2">기능 추가</h3>
                  <p className="text-sm text-neutral-500 mb-6">홈 화면에 추가하고 싶은 기능을 선택해주세요.</p>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
                    {WIDGET_OPTIONS.map(option => {
                      const isSelected = tempSelectedWidgets.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleWidgetSelection(option.id)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50/50' 
                              : 'border-neutral-200 bg-white hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-neutral-100 text-neutral-500'}`}>
                              {option.icon}
                            </div>
                            <span className="font-medium">{option.title}</span>
                          </div>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-blue-500 border-blue-500' : 'border-neutral-300 bg-white'
                          }`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    onClick={confirmWidgets}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-colors"
                  >
                    선택 완료
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* User Settings Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 z-40"
                  onClick={() => setIsSettingsOpen(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -20 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  className="absolute top-20 right-6 w-64 bg-white rounded-2xl shadow-xl overflow-hidden z-50 border border-neutral-100"
                >
                  <div className="p-4 border-b border-neutral-100 bg-neutral-50 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">당사자 (User)</p>
                      <p className="text-xs text-neutral-500">설정</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button className="w-full flex items-center gap-3 p-3 text-sm text-neutral-700 hover:bg-neutral-50 rounded-xl transition-colors">
                      <HelpCircle size={18} className="text-neutral-400" />
                      <span>앱 사용팁</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 text-sm text-neutral-700 hover:bg-neutral-50 rounded-xl transition-colors">
                      <Layout size={18} className="text-neutral-400" />
                      <span>화면설정</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 text-sm text-neutral-700 hover:bg-neutral-50 rounded-xl transition-colors">
                      <TypeIcon size={18} className="text-neutral-400" />
                      <span>글자크기</span>
                    </button>
                    <div className="w-full flex items-center justify-between p-3 text-sm text-neutral-700 hover:bg-neutral-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <Settings size={18} className="text-neutral-400" />
                        <span>쉬운 용어 모드</span>
                      </div>
                      <div className="w-10 h-6 bg-blue-500 rounded-full relative shadow-inner">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>
                    <div className="h-px bg-neutral-100 my-2 mx-2" />
                    <button className="w-full flex items-center gap-3 p-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                      <LogOut size={18} />
                      <span>로그아웃</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </div>
      </div>
    </DndProvider>
  );
}
