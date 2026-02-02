import React, { useState } from 'react';
import './Onboarding.css';

const Onboarding = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: '👋',
      title: 'Welcome to Task Tracker!',
      description: 'Your personal productivity companion. Let\'s take a quick tour of the features that will help you stay organized and track your time effectively.',
      tip: 'This tour only takes 30 seconds!'
    },
    {
      icon: '🏠',
      title: 'Home - Your Daily View',
      description: 'The Home tab shows your tasks organized by day or week. You can switch between Day view (focus on today) and Week view (see your entire week at a glance).',
      tip: 'Use the date picker to jump to any day quickly!'
    },
    {
      icon: '🏷️',
      title: 'Categories',
      description: 'Create categories to organize your tasks (e.g., Work, Study, Exercise). Each category can have its own color and icon for easy identification.',
      tip: 'Create categories first before adding tasks!'
    },
    {
      icon: '📋',
      title: 'Templates',
      description: 'Save time with templates! Create a weekly schedule template once, then apply it to any week. Perfect for recurring routines.',
      tip: 'Templates are great for weekly class schedules or workout plans.'
    },
    {
      icon: '⏱️',
      title: 'Time Tracking',
      description: 'Click the play button on any task to start tracking time. The app will record how long you spend on each task automatically.',
      tip: 'Only one task can be active at a time.'
    },
    {
      icon: '📈',
      title: 'Analytics',
      description: 'View detailed insights about your productivity. See weekly/monthly breakdowns, category-wise time spent, and track your progress.',
      tip: 'Check analytics weekly to improve your habits!'
    },
    {
      icon: '✅',
      title: 'Quick Todos',
      description: 'Need a simple checklist? Use Quick Todos for tasks that don\'t need time tracking. They appear alongside your main tasks in Day view.',
      tip: 'Overdue todos automatically carry over to today!'
    },
    {
      icon: '💤',
      title: 'Sleep Mode',
      description: 'Track your sleep with the Sleep button in the header. It automatically pauses all active tasks and logs your rest time.',
      tip: 'Sleep data is included in your analytics!'
    },
    {
      icon: '🚀',
      title: 'You\'re All Set!',
      description: 'Start by creating a few categories, then add your first tasks. Remember, consistency is key to productivity!',
      tip: 'Happy tracking! 🎉'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('onboardingComplete', 'true');
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <button className="onboarding-skip" onClick={handleSkip}>
          Skip Tour
        </button>
        
        <div className="onboarding-content">
          <div className="onboarding-icon">{step.icon}</div>
          <h2 className="onboarding-title">{step.title}</h2>
          <p className="onboarding-description">{step.description}</p>
          <div className="onboarding-tip">
            <span className="tip-icon">💡</span>
            <span className="tip-text">{step.tip}</span>
          </div>
        </div>

        <div className="onboarding-progress">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`progress-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
              onClick={() => setCurrentStep(index)}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          <button
            className="onboarding-btn btn-prev"
            onClick={handlePrev}
            disabled={isFirstStep}
          >
            ← Back
          </button>
          <button
            className="onboarding-btn btn-next"
            onClick={handleNext}
          >
            {isLastStep ? 'Get Started! 🚀' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
