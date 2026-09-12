import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StatCards from './components/StatCards';
import QuickTaskBar from './components/QuickTaskBar';
import TaskList from './components/TaskList';
import TaskModal from './components/TaskModal';
import SettingsModal from './components/SettingsModal';
import ConfirmModal from './components/ConfirmModal';
import AuthModal from './components/AuthModal';
import CalendarConnectionCard from './components/CalendarConnectionCard';
import CalendarReminderCard from './components/CalendarReminderCard';
import ToastContainer from './components/ToastContainer';
import { SoundFX } from './services/soundEngine';
import { AuthClient } from './services/authClient';
import {
  openGoogleCalendar,
  downloadICS,
  isGoogleCalendarConnected,
  requestGoogleCalendarAccess,
  saveEventToGoogleCalendar,
  fetchCalendarStatus,
  disconnectCalendar,
  startGoogleOAuth
} from './services/calendarService';
import { sendTaskEmail } from './services/emailService';
import {
  initPushSubscription,
  scheduleBackendReminder,
  cancelBackendReminder,
  calculateReminderTimeMs
} from './services/reminderSyncService';

const loadStorage = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const saveStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage error:', e);
  }
};

export default function App() {
  const [tasks, setTasks] = useState(() => {
    const saved = loadStorage('taskflow_tasks', []);
    return Array.isArray(saved) ? saved.filter(t => t.id !== 'task_demo_1') : [];
  });

  const [userName, setUserName] = useState(() => loadStorage('taskflow_user', 'My Workspace'));
  const [reminderEmail, setReminderEmail] = useState(() => loadStorage('taskflow_email', ''));
  const [palette, setPalette] = useState(() => loadStorage('taskflow_palette', 'indigo'));
  const [soundEnabled, setSoundEnabled] = useState(() => loadStorage('taskflow_sound', true));

  const [currentFilter, setCurrentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSort, setCurrentSort] = useState('deadline-asc');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => loadStorage('taskflow_sidebar_collapsed', false));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [taskToDeleteId, setTaskToDeleteId] = useState(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [urlResetToken, setUrlResetToken] = useState('');

  // Check existing session on load & listen for ?resetToken in URL
  useEffect(() => {
    AuthClient.getCurrentUser().then(user => {
      if (user) {
        setCurrentUser(user);
        if (user.name) setUserName(user.name);
        if (user.email) setReminderEmail(user.email);
      }
    });

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('resetToken');
      if (token) {
        setUrlResetToken(token);
        setAuthModalMode('reset');
        setIsAuthModalOpen(true);
      }
    }
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    if (user.name) setUserName(user.name);
    if (user.email) setReminderEmail(user.email);
  };

  const handleLogout = async () => {
    await AuthClient.logout();
    setCurrentUser(null);
    showToast('info', '👋', 'You have been logged out.');
  };

  const handleOpenAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  // Google Calendar Connection State
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  // Sync Google Calendar connection status and handle OAuth callback redirects
  useEffect(() => {
    fetchCalendarStatus().then(connected => {
      setIsCalendarConnected(connected);
    });

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('calendar_connected') === 'true') {
        setIsCalendarConnected(true);
        showToast('success', '📅', 'Google Calendar connected successfully!');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get('calendar_error')) {
        const err = params.get('calendar_error');
        showToast('error', '⚠️', err === 'denied' ? 'Google Calendar access was denied.' : 'Google Calendar connection failed.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [currentUser]);

  const handleConnectCalendar = () => {
    if (!currentUser) {
      handleOpenAuthModal('login');
      showToast('info', '🔒', 'Please sign in before connecting Google Calendar.');
      return;
    }
    startGoogleOAuth();
  };

  const handleDisconnectCalendar = async () => {
    setIsCalendarLoading(true);
    try {
      await disconnectCalendar();
      setIsCalendarConnected(false);
      showToast('info', '📅', 'Google Calendar disconnected.');
    } catch (err) {
      showToast('error', '❌', 'Failed to disconnect Google Calendar.');
    } finally {
      setIsCalendarLoading(false);
    }
  };

  // Toasts
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, icon, message) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, type, icon, message }]);
    const duration = (type === 'reminder' || type === 'error') ? 11000 : 4500;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const [pushSub, setPushSub] = useState(null);

  // Mobile Pull-to-Refresh Gesture
  const scrollRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    } else {
      isPulling.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0 && scrollRef.current && scrollRef.current.scrollTop <= 0) {
      const dampened = Math.min(diff * 0.4, 75);
      setPullDistance(dampened);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= 48) {
      setIsRefreshing(true);
      setPullDistance(48);
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } else {
      setPullDistance(0);
    }
  };

  // Initialize Web Push Notifications & Background Service Worker
  useEffect(() => {
    initPushSubscription().then(sub => {
      if (sub) {
        setPushSub(sub);
        console.log('[TaskFlow] Web Push active & registered for background alerts');
      }
    });

    const handleSWMessage = (event) => {
      if (event.data?.type === 'TASKFLOW_ALERT_OPENED') {
        SoundFX.playBellChime(true);
        showToast('reminder', '🔔', `Task Reminder: ${event.data.task?.title || 'Deadline reached'}`);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    }
  }, [showToast]);

  // Live in-app reminder & audio bell checking ticker (runs every 2 seconds)
  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      let hasUpdates = false;

      tasks.forEach(task => {
        if (task.completed) return;

        const reminderMs = calculateReminderTimeMs(task);
        const deadlineMs = task.deadline ? new Date(task.deadline).getTime() : null;

        // 1. In-App Reminder Alert at reminder time
        if (reminderMs && now >= reminderMs && !task.reminderAlertTriggered) {
          task.reminderAlertTriggered = true;
          hasUpdates = true;

          // Sound executive bell chime
          if (soundEnabled && (task.channels?.sound ?? true)) {
            SoundFX.playAlarm(true);
          }

          // In-app alert banner toast
          showToast('reminder', '⏰', `REMINDER ALERT: "${task.title}" deadline approaching!`);

          // Desktop alert notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`⏰ Reminder: ${task.title}`, {
                body: `Deadline: ${new Date(task.deadline).toLocaleString()} • Priority: ${(task.priority || 'medium').toUpperCase()}`,
                icon: '/icons/icon-192.png',
                tag: `alert-rem-${task.id}`,
                requireInteraction: true
              });
            } catch (e) {}
          }

          // Automated email alert dispatched exactly when scheduled reminder time arrives
          if (task.channels?.email && (task.reminderEmail || reminderEmail) && !task.reminderEmailSent) {
            task.reminderEmailSent = true;
            const target = task.reminderEmail || reminderEmail;
            sendTaskEmail({
              taskId: task.id,
              recipient: target,
              title: task.title,
              description: task.description,
              deadline: task.deadline,
              priority: task.priority,
              reminderTime: reminderMs
            }).then(res => {
              if (res?.success) {
                showToast('success', '📧', `Reminder email sent to ${target}!`);
              }
            });
          }
        }

        // 2. In-App Deadline Reached Alert
        if (deadlineMs && now >= deadlineMs && !task.deadlineAlertTriggered) {
          task.deadlineAlertTriggered = true;
          hasUpdates = true;

          if (soundEnabled && (task.channels?.sound ?? true)) {
            SoundFX.playAlarm(true);
          }

          showToast('error', '🚨', `DEADLINE REACHED: "${task.title}"!`);

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`🚨 Task Deadline: ${task.title}`, {
                body: `Task deadline is due now! Priority: ${(task.priority || 'medium').toUpperCase()}`,
                icon: '/icons/icon-192.png',
                tag: `alert-dead-${task.id}`,
                requireInteraction: true
              });
            } catch (e) {}
          }
        }
      });

      if (hasUpdates) {
        setTasks([...tasks]);
      }
    };

    const intervalId = setInterval(checkReminders, 2000);
    return () => clearInterval(intervalId);
  }, [tasks, soundEnabled, showToast, reminderEmail]);

  // Instant Alert Notification & Audio Bell Test Handler
  const handleTestAlerts = async () => {
    SoundFX.unlockAudio();
    SoundFX.playAlarm(true);

    let perm = 'default';
    if ('Notification' in window) {
      perm = await Notification.requestPermission();
    }

    if (perm === 'granted') {
      const sub = await initPushSubscription();
      if (sub) setPushSub(sub);

      try {
        new Notification('🔔 TaskFlow Pro Notifications Active', {
          body: 'System alert notifications and audio bell chime are verified and working!',
          icon: '/icons/icon-192.png'
        });
      } catch (e) {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: '🔔 TaskFlow Pro Notifications Active',
            body: 'System alert notifications and audio bell chime are verified and working!'
          });
        }
      }
      showToast('success', '🔔', 'Desktop notifications & audio bell chime verified!');
    } else {
      showToast('info', '🔔', 'Audio bell tested! Note: Please click "Allow" on the notification popup to enable desktop banners.');
    }
  };

  useEffect(() => { saveStorage('taskflow_tasks', tasks); }, [tasks]);
  useEffect(() => { saveStorage('taskflow_user', userName); }, [userName]);
  useEffect(() => { saveStorage('taskflow_email', reminderEmail); }, [reminderEmail]);
  useEffect(() => {
    saveStorage('taskflow_palette', palette);
    document.documentElement.setAttribute('data-theme', palette);
  }, [palette]);
  useEffect(() => { saveStorage('taskflow_sound', soundEnabled); }, [soundEnabled]);
  useEffect(() => { saveStorage('taskflow_sidebar_collapsed', isSidebarCollapsed); }, [isSidebarCollapsed]);

  // Global Keyboard Shortcuts (N for New Task, Escape for Modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsTaskModalOpen(false);
        setIsSettingsModalOpen(false);
        setTaskToDeleteId(null);
        setIsMobileSidebarOpen(false);
      }
      if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        setTaskToEdit(null);
        setIsTaskModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter & Search Logic
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.priority && t.priority.toLowerCase().includes(q))
      );
    }

    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (currentFilter === 'completed') {
      result = result.filter(t => t.completed);
    } else {
      result = result.filter(t => !t.completed);

      if (currentFilter === 'today') {
        result = result.filter(t => {
          if (!t.deadline) return false;
          const d = new Date(t.deadline).getTime();
          return d <= todayEnd.getTime();
        });
      } else if (currentFilter === 'upcoming') {
        result = result.filter(t => {
          if (!t.deadline) return false;
          return new Date(t.deadline).getTime() > now;
        });
      } else if (currentFilter === 'high') {
        result = result.filter(t => t.priority === 'high');
      } else if (currentFilter === 'overdue') {
        result = result.filter(t => {
          if (!t.deadline) return false;
          return new Date(t.deadline).getTime() < now;
        });
      }
    }

    result.sort((a, b) => {
      if (currentSort === 'deadline-asc') {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (currentSort === 'deadline-desc') {
        return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
      }
      if (currentSort === 'priority-desc') {
        const order = { high: 3, medium: 2, low: 1 };
        return (order[b.priority] || 0) - (order[a.priority] || 0);
      }
      if (currentSort === 'created-desc') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (currentSort === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  }, [tasks, currentFilter, searchQuery, currentSort]);

  const taskCounts = useMemo(() => {
    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return {
      all: tasks.filter(t => !t.completed).length,
      today: tasks.filter(t => !t.completed && t.deadline && new Date(t.deadline).getTime() <= todayEnd.getTime()).length,
      upcoming: tasks.filter(t => !t.completed && t.deadline && new Date(t.deadline).getTime() > now).length,
      high: tasks.filter(t => !t.completed && t.priority === 'high').length,
      overdue: tasks.filter(t => !t.completed && t.deadline && new Date(t.deadline).getTime() < now).length,
      completed: tasks.filter(t => t.completed).length
    };
  }, [tasks]);

  const stats = useMemo(() => {
    return {
      total: taskCounts.all,
      today: taskCounts.today,
      high: taskCounts.high,
      completed: taskCounts.completed
    };
  }, [taskCounts]);

  const handleQuickAdd = (title) => {
    const def = new Date();
    def.setDate(def.getDate() + 1);
    def.setHours(17, 0, 0, 0);
    const defLocal = new Date(def.getTime() - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title,
      description: '',
      deadline: defLocal,
      priority: 'medium',
      reminderMode: 'preset',
      reminderPresetMinutes: 15,
      channels: { push: true, sound: true, calendar: true, email: false },
      completed: false,
      createdAt: new Date().toISOString()
    };

    setTasks(prev => [newTask, ...prev]);
    showToast('success', '✨', `"${title}" added`);

    scheduleBackendReminder(newTask, {
      subscription: pushSub,
      defaultEmail: reminderEmail
    });
  };

  const handleSaveTask = (taskData) => {
    const remMs = calculateReminderTimeMs(taskData);
    const isFutureReminder = remMs && remMs > Date.now();

    let savedTask;
    if (taskToEdit) {
      savedTask = {
        ...taskToEdit,
        ...taskData,
        reminderAlertTriggered: isFutureReminder ? false : taskToEdit.reminderAlertTriggered,
        reminderEmailSent: isFutureReminder ? false : taskToEdit.reminderEmailSent
      };
      setTasks(prev =>
        prev.map(t => (t.id === taskToEdit.id ? savedTask : t))
      );
      showToast('info', '📝', 'Task updated');
    } else {
      savedTask = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        ...taskData,
        reminderAlertTriggered: false,
        reminderEmailSent: false,
        completed: false,
        createdAt: new Date().toISOString()
      };
      setTasks(prev => [savedTask, ...prev]);
      showToast('success', '✨', `"${taskData.title}" saved`);
    }

    // 1. Sync persistent background reminder to server (fires when scheduled time arrives)
    scheduleBackendReminder(savedTask, {
      subscription: pushSub,
      defaultEmail: reminderEmail
    }).then(res => {
      if (res?.success) {
        showToast('info', '⏰', 'Background alert scheduled');
      }
    });

    const targetEmail = (taskData.reminderEmail || reminderEmail || '').trim();

    // 2. Direct Delivery for ANY user (Public & Universal):
    // If a Gmail/Email is provided and Calendar or Email channels are active, dispatch immediately
    if (targetEmail && (taskData.channels?.calendar || taskData.channels?.email)) {
      sendTaskEmail({
        taskId: savedTask.id,
        recipient: targetEmail,
        title: savedTask.title,
        description: savedTask.description,
        deadline: savedTask.deadline,
        priority: savedTask.priority,
        reminderTime: remMs
      }).then(res => {
        if (res?.success) {
          savedTask.reminderEmailSent = true;
          showToast('success', '📧', `Task & Google Calendar invite sent to ${targetEmail}!`);
        } else {
          console.warn('Email/calendar delivery notice:', res?.error);
        }
      });
    }

    // 3. Silent Google Calendar REST API Auto-Save (only if user explicitly authorized OAuth)
    if (taskData.channels?.calendar && savedTask.deadline && isGoogleCalendarConnected()) {
      saveEventToGoogleCalendar(savedTask, targetEmail).then(gcalRes => {
        if (gcalRes?.success) {
          showToast('success', '📅', 'Auto-saved directly to Google Calendar!');
        }
      }).catch(err => {
        console.warn('Silent Google Calendar sync note:', err);
      });
    }

    if (isFutureReminder && taskData.channels?.email) {
      const formattedTime = new Date(remMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      showToast('info', '⏰', `Email reminder scheduled for ${formattedTime}`);
    }

    setIsTaskModalOpen(false);
    setTaskToEdit(null);
  };

  const handleToggleComplete = (id) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          const nextState = !t.completed;
          if (nextState) {
            SoundFX.playSuccessChord(soundEnabled);
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.7 }
            });
            showToast('success', '🎉', 'Task finished! Great momentum.');
            cancelBackendReminder(id);
          } else {
            // Re-schedule reminder if uncompleted
            scheduleBackendReminder(t, {
              subscription: pushSub,
              defaultEmail: reminderEmail
            });
          }
          return {
            ...t,
            completed: nextState,
            completedAt: nextState ? new Date().toISOString() : null
          };
        }
        return t;
      })
    );
  };

  const handleDeleteTask = (id) => {
    setTaskToDeleteId(id);
  };

  const executeDeleteTask = () => {
    if (taskToDeleteId) {
      const target = tasks.find(t => t.id === taskToDeleteId);
      cancelBackendReminder(taskToDeleteId);
      setTasks(prev => prev.filter(t => t.id !== taskToDeleteId));
      showToast('error', '🗑️', `"${target?.title || 'Task'}" deleted`);
      setTaskToDeleteId(null);
    }
  };

  const handleSyncGoogleCalendar = async (task) => {
    const targetEmail = (task.reminderEmail || reminderEmail || '').trim();

    // If Google OAuth session is already active, try direct REST API save
    if (isGoogleCalendarConnected()) {
      showToast('info', '⏳', targetEmail ? `Saving to Google Calendar for ${targetEmail}...` : 'Saving to Google Calendar...');
      try {
        const res = await saveEventToGoogleCalendar(task, targetEmail);
        if (res?.success) {
          showToast('success', '🎉', targetEmail ? `Directly saved to Google Calendar for ${targetEmail}!` : 'Directly saved to your Google Calendar!');
          return;
        }
      } catch (err) {
        console.warn('Direct OAuth save failed, using 1-click Google Calendar:', err);
      }
    }

    // Universal 1-Click Google Calendar (Works for 100% of users, zero OAuth blocks)
    openGoogleCalendar(task, targetEmail);
    showToast('success', '📅', 'Opening in Google Calendar...');

    // Also dispatch email invite if email is present
    if (targetEmail) {
      sendTaskEmail({
        taskId: task.id,
        recipient: targetEmail,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        priority: task.priority,
        reminderTime: calculateReminderTimeMs(task)
      });
    }
  };

  const handleDownloadICS = (task) => {
    downloadICS(task);
    showToast('success', '📥', 'Calendar .ics event downloaded with alarm!');
  };

  const handleSendEmail = async (task) => {
    const target = (task.reminderEmail || reminderEmail || '').trim();
    if (!target) {
      showToast('error', '⚠️', 'Please enter a recipient Gmail/email address in task or Settings.');
      return;
    }
    showToast('info', '⏳', `Sending automated email & calendar invite via Resend to ${target}...`);

    const res = await sendTaskEmail({
      taskId: task.id,
      recipient: target,
      title: task.title,
      description: task.description,
      deadline: task.deadline,
      priority: task.priority
    });

    if (res.success) {
      showToast('success', '📧', `Email & Google Calendar invite delivered to ${target}!`);
    } else {
      showToast('error', '❌', res.error || 'Failed to dispatch email');
    }
  };

  const handleSaveProfile = ({ name, email }) => {
    if (name) setUserName(name);
    if (email) setReminderEmail(email);
  };

  return (
    <div className="app-layout">
      {/* Left Sidebar Rail */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentFilter={currentFilter}
        onSelectFilter={setCurrentFilter}
        taskCounts={taskCounts}
        currentPalette={palette}
        onChangePalette={setPalette}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        userName={userName}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenNewTask={() => {
          setTaskToEdit(null);
          setIsTaskModalOpen(true);
        }}
        currentUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        onLogout={handleLogout}
      />

      {/* Main Workspace Canvas */}
      <main className="app-main">
        {/* Sticky Topbar */}
        <Header
          currentFilter={currentFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentSort={currentSort}
          onSortChange={setCurrentSort}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenNewTask={() => {
            setTaskToEdit(null);
            setIsTaskModalOpen(true);
          }}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onTestAlerts={handleTestAlerts}
          currentUser={currentUser}
          onOpenAuthModal={handleOpenAuthModal}
          onLogout={handleLogout}
        />

        {/* Scrollable Canvas Area with Mobile Pull-to-Refresh */}
        <div
          ref={scrollRef}
          className="main-content-scroll"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile Pull-to-Refresh Visual Indicator */}
          {pullDistance > 0 && (
            <div
              className={`pull-indicator ${pullDistance >= 48 ? 'ready' : ''} ${isRefreshing ? 'refreshing' : ''}`}
              style={{ height: `${pullDistance}px` }}
            >
              <div className="pull-indicator-pill">
                <span className={`pull-icon ${isRefreshing ? 'spinning' : ''}`}>🔄</span>
                <span className="pull-text">
                  {isRefreshing ? 'Refreshing application...' : pullDistance >= 48 ? 'Release to refresh' : 'Pull down to refresh'}
                </span>
              </div>
            </div>
          )}
          {/* Canvas Hero & Metrics Strip */}
          <StatCards
            userName={userName}
            stats={stats}
            currentFilter={currentFilter}
            onSelectFilter={setCurrentFilter}
          />

          {/* Quick Inline Task Bar */}
          <QuickTaskBar
            onQuickAdd={handleQuickAdd}
            onOpenDetailedModal={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
          />

          {/* Direct Google Calendar Reminder Card (Compact, Click-to-Open) */}
          <CalendarReminderCard
            isCalendarConnected={isCalendarConnected}
            isCalendarLoading={isCalendarLoading}
            currentUser={currentUser}
            onConnectCalendar={handleConnectCalendar}
            onDisconnectCalendar={handleDisconnectCalendar}
            onOpenAuthModal={handleOpenAuthModal}
            onShowToast={showToast}
          />

          {/* Task Details & Workspace Card (Compact, Click-to-Open) */}
          <TaskList
            tasks={filteredTasks}
            onToggleComplete={handleToggleComplete}
            onEdit={id => {
              const target = tasks.find(t => t.id === id);
              if (target) {
                setTaskToEdit(target);
                setIsTaskModalOpen(true);
              }
            }}
            onDelete={handleDeleteTask}
            onSyncGoogleCalendar={handleSyncGoogleCalendar}
            onDownloadICS={handleDownloadICS}
            onSendEmail={handleSendEmail}
            onOpenNewTask={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
            currentFilter={currentFilter}
          />
        </div>
      </main>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        defaultEmail={reminderEmail}
        soundEnabled={soundEnabled}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userName={userName}
        reminderEmail={reminderEmail}
        onSaveProfile={handleSaveProfile}
        onShowToast={showToast}
        isCalendarConnected={isCalendarConnected}
        isCalendarLoading={isCalendarLoading}
        onConnectCalendar={handleConnectCalendar}
        onDisconnectCalendar={handleDisconnectCalendar}
        currentUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        onLogout={handleLogout}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setUrlResetToken('');
        }}
        initialMode={authModalMode}
        resetToken={urlResetToken}
        currentUser={currentUser}
        onAuthSuccess={handleAuthSuccess}
        onShowToast={showToast}
      />

      <ConfirmModal
        isOpen={!!taskToDeleteId}
        onConfirm={executeDeleteTask}
        onCancel={() => setTaskToDeleteId(null)}
      />

      {/* Floating Action Button (Mobile) */}
      <button
        type="button"
        className="fab"
        onClick={() => {
          setTaskToEdit(null);
          setIsTaskModalOpen(true);
        }}
        title="Add New Task (Shortcut: N)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))}
      />
    </div>
  );
}
