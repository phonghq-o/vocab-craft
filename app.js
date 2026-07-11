// ==========================================================================
// VocabCraft Application Logic
// ==========================================================================

// Application State
const state = {
  apiKey: localStorage.getItem('vocab_craft_api_key') || '',
  questions: [],
  currentQuestionIndex: 0,
  studentAnswers: [],
  score: 0,
  quizMode: false, // false = creator, true = quiz
  isAnswerChecked: false,
  timerMode: 'practice', // 'practice' or 'test'
  timerInterval: null,
  timeLeft: 45
};

// DOM Elements
const elements = {
  // Settings / API
  secApiKey: document.getElementById('sec-api-key'),
  inputApiKey: document.getElementById('input-api-key'),
  btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
  btnSaveKey: document.getElementById('btn-save-key'),
  btnSettings: document.getElementById('btn-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnToggleView: document.getElementById('btn-toggle-view'),

  // Views
  viewTeacher: document.getElementById('view-teacher'),
  viewQuiz: document.getElementById('view-quiz'),
  viewResults: document.getElementById('view-results'),
  viewGrading: document.getElementById('view-grading'),
  viewLoadingQuiz: document.getElementById('view-loading-quiz'),
  viewModeSelection: document.getElementById('view-mode-selection'),

  // Teacher / Creator
  promptInput: document.getElementById('prompt-input'),
  btnGenerate: document.getElementById('btn-generate'),
  previewEmptyState: document.getElementById('preview-empty-state'),
  previewLoader: document.getElementById('preview-loader'),
  previewContent: document.getElementById('preview-content'),
  quizPreviewTitle: document.getElementById('quiz-preview-title'),
  quizPreviewCount: document.getElementById('quiz-preview-count'),
  previewQuestionsList: document.getElementById('preview-questions-list'),
  btnStartQuiz: document.getElementById('btn-start-quiz'),
  btnShareQuiz: document.getElementById('btn-share-quiz'),
  shareLinkContainer: document.getElementById('share-link-container'),
  shareLinkInput: document.getElementById('share-link-input'),
  btnCopyShareLink: document.getElementById('btn-copy-share-link'),
  presetChips: document.querySelectorAll('.chip'),

  // Quiz Taker
  quizQuestionNumber: document.getElementById('quiz-question-number'),
  quizProgressFill: document.getElementById('quiz-progress-fill'),
  quizIpaPronunciation: document.getElementById('quiz-ipa-pronunciation'),
  btnSpeak: document.getElementById('btn-speak'),
  inputStudentEnglish: document.getElementById('input-student-english'),
  inputStudentVietnamese: document.getElementById('input-student-vietnamese'),
  btnNextQuestion: document.getElementById('btn-next-question'),
  btnPrevQuestion: document.getElementById('btn-prev-question'),
  quizPracticeHint: document.getElementById('quiz-practice-hint'),
  quizTimer: document.getElementById('quiz-timer'),
  btnModePractice: document.getElementById('btn-mode-practice'),
  btnModeTest: document.getElementById('btn-mode-test'),

  // Results
  resultsHeadline: document.getElementById('results-headline'),
  resultsScoreTrue: document.getElementById('results-score-true'),
  resultsScoreFalse: document.getElementById('results-score-false'),
  resultsReviewList: document.getElementById('results-review-list'),
  btnRetryQuiz: document.getElementById('btn-retry-quiz'),
  btnNewQuiz: document.getElementById('btn-new-quiz'),
  resultsBadgeIcon: document.getElementById('results-badge-icon')
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Load saved API Key if available
  if (state.apiKey) {
    elements.inputApiKey.value = state.apiKey;
  }

  setupEventListeners();

  // URL Parameter Routing (Load shared quiz)
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get('quiz');
  if (quizId) {
    loadSharedQuiz(quizId);
  }
});

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
  // API Key Setup Actions
  elements.btnSaveKey.addEventListener('click', saveApiKey);
  elements.btnToggleKeyVisibility.addEventListener('click', toggleKeyVisibility);
  elements.btnSettings.addEventListener('click', () => {
    elements.secApiKey.classList.toggle('active');
  });
  elements.btnCloseSettings.addEventListener('click', () => {
    elements.secApiKey.classList.remove('active');
  });

  // Presets / Chips
  elements.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.promptInput.value = chip.getAttribute('data-prompt').replace(/\\n/g, '\n');
      // Highlight selection slightly if desired, or just focus textarea
      elements.promptInput.focus();
    });
  });

  // Generator Action
  elements.btnGenerate.addEventListener('click', generateExercises);

  // Start Quiz
  elements.btnStartQuiz.addEventListener('click', startQuiz);

  // Quiz Interaction
  elements.btnSpeak.addEventListener('click', () => {
    const currentQuestion = state.questions[state.currentQuestionIndex];
    if (currentQuestion) {
      speakWord(currentQuestion.english_word);
    }
  });

  elements.btnNextQuestion.addEventListener('click', nextQuestion);

  // Key press listener for quiz inputs (Enter key goes to next question/focuses next field)
  elements.inputStudentEnglish.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elements.inputStudentVietnamese.focus();
    }
  });

  elements.inputStudentVietnamese.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextQuestion();
    }
  });

  // Previous Question navigation
  if (elements.btnPrevQuestion) {
    elements.btnPrevQuestion.addEventListener('click', prevQuestion);
  }

  // Results Actions
  elements.btnRetryQuiz.addEventListener('click', retryQuiz);
  elements.btnNewQuiz.addEventListener('click', () => {
    switchView('view-teacher');
    elements.btnToggleView.style.display = 'none';
  });

  // Back button in header
  elements.btnToggleView.addEventListener('click', () => {
    clearInterval(state.timerInterval);
    switchView('view-teacher');
    elements.btnToggleView.style.display = 'none';
    // Clear sharing query parameter if returning to creator
    window.history.replaceState({}, document.title, window.location.pathname);
  });

  // Sharing Actions
  if (elements.btnShareQuiz) elements.btnShareQuiz.addEventListener('click', saveQuiz);
  if (elements.btnCopyShareLink) elements.btnCopyShareLink.addEventListener('click', copyShareLink);

  // Mode Selection Actions
  if (elements.btnModePractice) elements.btnModePractice.addEventListener('click', () => selectQuizMode('practice'));
  if (elements.btnModeTest) elements.btnModeTest.addEventListener('click', () => selectQuizMode('test'));
}

// ==========================================================================
// API Key Logic
// ==========================================================================
function saveApiKey() {
  const value = elements.inputApiKey.value.trim();
  if (value) {
    state.apiKey = value;
    localStorage.setItem('vocab_craft_api_key', value);
    showToast('Lưu khóa API thành công!', 'success');
    elements.secApiKey.classList.remove('active');
  } else {
    showToast('Vui lòng nhập một mã khóa API hợp lệ.', 'error');
  }
}

function toggleKeyVisibility() {
  const type = elements.inputApiKey.getAttribute('type') === 'password' ? 'text' : 'password';
  elements.inputApiKey.setAttribute('type', type);
  
  // Toggle the icon
  const icon = elements.btnToggleKeyVisibility.querySelector('i');
  if (type === 'text') {
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    icon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
}

// ==========================================================================
// Navigation & Views
// ==========================================================================
function switchView(viewId) {
  // Hide all views
  elements.viewTeacher.classList.remove('active');
  elements.viewQuiz.classList.remove('active');
  elements.viewResults.classList.remove('active');
  if (elements.viewGrading) elements.viewGrading.classList.remove('active');
  if (elements.viewLoadingQuiz) elements.viewLoadingQuiz.classList.remove('active');
  if (elements.viewModeSelection) elements.viewModeSelection.classList.remove('active');

  // Show active view
  const activeView = document.getElementById(viewId);
  if (activeView) {
    activeView.classList.add('active');
  }
}

// ==========================================================================
// Gemini API Integration
// ==========================================================================
async function generateExercises() {
  const promptText = elements.promptInput.value.trim();

  // Validations
  if (!promptText) {
    showToast('Vui lòng nhập danh sách từ vựng hoặc chủ đề gợi ý trước.', 'error');
    return;
  }

  // Toggle Loading State
  elements.previewEmptyState.style.display = 'none';
  elements.previewContent.style.display = 'none';
  elements.previewLoader.style.display = 'flex';
  elements.btnGenerate.disabled = true;

  try {
    const response = await callGeminiAPI(promptText);
    
    // Parse result
    if (!response || !response.questions || response.questions.length === 0) {
      throw new Error('Failed to extract valid questions from API response.');
    }

    state.questions = response.questions;
    renderPreviewList(response);
    
    // Switch to preview content
    elements.previewLoader.style.display = 'none';
    elements.previewContent.style.display = 'block';
  } catch (error) {
    console.error(error);
    elements.previewLoader.style.display = 'none';
    elements.previewEmptyState.style.display = 'flex';
    
    // Check if error is due to missing API Key
    if (error.message.includes('API Key') || error.message.includes('API key') || error.message.includes('key is not configured')) {
      elements.secApiKey.classList.add('active');
      elements.secApiKey.scrollIntoView({ behavior: 'smooth' });
      showToast('Không tìm thấy khóa API. Vui lòng cài đặt ở nút hình chìa khóa.', 'error');
    } else {
      showToast(`Lỗi: ${error.message || 'Không thể tạo đề bài tập.'}`, 'error');
    }
  } finally {
    elements.btnGenerate.disabled = false;
  }
}

async function callGeminiAPI(promptText) {
  // Define Schema for structured output
  const responseSchema = {
    type: "OBJECT",
    properties: {
      title: { type: "STRING", description: "A catchy, short title for this vocabulary test" },
      questions: {
        type: "ARRAY",
        description: "List of generated vocabulary questions",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "INTEGER", description: "Sequential question ID starting from 1" },
            english_word: { type: "STRING", description: "The English translation of the vocabulary word (e.g. tortoise, dolphin, elephant) in lowercase" },
            vietnamese_word: { type: "STRING", description: "The Vietnamese meaning of the vocabulary word (e.g. con rùa, con cá heo, con voi) in lowercase" },
            pronunciation: { type: "STRING", description: "The standard IPA pronunciation guide of the English word (e.g. /ˈtɔː.təs/)" },
            clue: { 
              type: "STRING", 
              description: "A short English contextual description containing a blank (marked as _______) indicating where the English word belongs. Must include a blank and be grammatically sound."
            },
            correct_answer: { 
              type: "STRING", 
              description: "The answer formatted exactly as 'english_word:vietnamese_word' in lowercase, e.g. 'tortoise:con rùa'." 
            }
          },
          required: ["id", "english_word", "vietnamese_word", "pronunciation", "clue", "correct_answer"]
        }
      }
    },
    required: ["title", "questions"]
  };

  const systemInstruction = `You are a helpful assistant for an English tutoring web application. 
Your task is to translate the teacher's input vocabulary list or general instruction prompt into high-quality fill-in-the-blank style exercise questions.

For each word:
1. Identify the English translation and standard Vietnamese translation.
2. Provide the standard English IPA pronunciation.
3. Formulate an interesting English sentence with a blank (represented as "_______") that the student must fill with the English word.
4. Set the correct_answer field strictly in the format: "english_word:vietnamese_word" (all lowercase, e.g. "tortoise:con rùa").

Ensure that all words matching the teacher's list are correctly processed and included in the output.`;

  const requestBody = {
    contents: [{
      parts: [{ text: `Teacher prompt: ${promptText}` }]
    }],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2
    }
  };

  let data;
  if (state.apiKey) {
    // Local client-side call
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || response.statusText || 'API request failed';
      throw new Error(errMsg);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from model.');
    }
    return JSON.parse(rawText);
  } else {
    // Production serverless backend call
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: promptText })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error || errData.message || response.statusText || 'Lỗi kết nối máy chủ không thể tạo bài tập.';
      throw new Error(errMsg);
    }

    return await response.json();
  }
}

function renderPreviewList(data) {
  elements.quizPreviewTitle.innerText = data.title || 'Đề Ôn Tập Từ Vựng';
  elements.quizPreviewCount.innerText = `${data.questions.length} Câu Hỏi`;
  elements.previewQuestionsList.innerHTML = '';

  data.questions.forEach(q => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <div class="preview-item-word">
        <span class="preview-english">${q.english_word} <span style="font-weight: normal; color: var(--text-muted);">${q.pronunciation}</span></span>
        <span class="preview-vietnamese">${q.vietnamese_word}</span>
      </div>
      <p class="preview-sentence">${q.clue}</p>
    `;
    elements.previewQuestionsList.appendChild(item);
  });
}

// ==========================================================================
// Text To Speech (Pronunciation Synthesis)
// ==========================================================================
function speakWord(word) {
  if (!('speechSynthesis' in window)) {
    showToast('Trình duyệt của bạn không hỗ trợ đọc phát âm.', 'error');
    return;
  }

  // Cancel any active speakings
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  
  // Try to find a high quality English voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) 
    || voices.find(v => v.lang.startsWith('en'))
    || voices[0];
    
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// ==========================================================================
// Quiz Taker Logic (Student Panel)
// ==========================================================================
function startQuiz() {
  if (state.questions.length === 0) {
    showToast('Chưa có danh sách câu hỏi. Vui lòng soạn đề bài trước.', 'error');
    return;
  }

  elements.btnToggleView.style.display = 'inline-flex';
  switchView('view-mode-selection');
}

function selectQuizMode(mode) {
  state.timerMode = mode;
  launchQuiz();
}

function launchQuiz() {
  state.currentQuestionIndex = 0;
  state.studentAnswers = [];
  state.score = 0;
  state.quizMode = true;

  switchView('view-quiz');
  showQuestion(0);
}

function showQuestion(index) {
  const q = state.questions[index];

  // Reset/Clear timer
  clearInterval(state.timerInterval);
  if (elements.quizTimer) {
    elements.quizTimer.classList.remove('warning');
  }

  // Update indices and progress bars
  elements.quizQuestionNumber.innerText = `Câu hỏi ${index + 1} / ${state.questions.length}`;
  const progressPercent = ((index) / state.questions.length) * 100;
  elements.quizProgressFill.style.width = `${progressPercent}%`;

  // Populate data
  elements.quizIpaPronunciation.innerText = q.pronunciation;

  // Prefill inputs if student answered this question before
  const prevAnswer = state.studentAnswers[index];
  if (prevAnswer) {
    elements.inputStudentEnglish.value = prevAnswer.studentEnglish || '';
    elements.inputStudentVietnamese.value = prevAnswer.studentVietnamese || '';
  } else {
    elements.inputStudentEnglish.value = '';
    elements.inputStudentVietnamese.value = '';
  }
  
  elements.inputStudentEnglish.classList.remove('text-success', 'text-error');
  elements.inputStudentVietnamese.classList.remove('text-success', 'text-error');
  
  elements.inputStudentEnglish.focus();

  // Set button text: "Next Question" or "Finish Quiz"
  if (index === state.questions.length - 1) {
    elements.btnNextQuestion.innerHTML = `Hoàn Thành Bài Tập <i data-lucide="check-circle"></i>`;
  } else {
    elements.btnNextQuestion.innerHTML = `Câu Tiếp Theo <i data-lucide="arrow-right"></i>`;
  }
  lucide.createIcons();

  // Practice Mode vs Test Mode specific layout adjustments
  if (state.timerMode === 'practice') {
    if (elements.quizTimer) {
      elements.quizTimer.style.display = 'none';
    }
    
    // Show/hide prev question button based on current index
    if (elements.btnPrevQuestion) {
      elements.btnPrevQuestion.style.display = index > 0 ? 'inline-flex' : 'none';
    }
    if (elements.quizPracticeHint) {
      elements.quizPracticeHint.style.display = 'block';
    }
  } else {
    // Test Mode
    if (elements.quizTimer) {
      elements.quizTimer.style.display = 'inline-flex';
      state.timeLeft = 45;
      elements.quizTimer.innerHTML = `<i data-lucide="clock"></i> 00:45`;
      lucide.createIcons();

      state.timerInterval = setInterval(() => {
        state.timeLeft--;

        // Update UI Text
        const secs = state.timeLeft < 10 ? '0' + state.timeLeft : state.timeLeft;
        elements.quizTimer.innerHTML = `<i data-lucide="clock"></i> 00:${secs}`;
        lucide.createIcons();

        // Under 10s warnings
        if (state.timeLeft <= 10) {
          elements.quizTimer.classList.add('warning');
        }

        if (state.timeLeft <= 0) {
          clearInterval(state.timerInterval);
          showToast('Hết thời gian làm câu hỏi! Chuyển sang câu tiếp theo.', 'info');
          nextQuestion();
        }
      }, 1000);
    }
    
    if (elements.btnPrevQuestion) {
      elements.btnPrevQuestion.style.display = 'none';
    }
    if (elements.quizPracticeHint) {
      elements.quizPracticeHint.style.display = 'none';
    }
  }

  // Automate English word spelling pronunciation on question display
  setTimeout(() => {
    if (state.quizMode && state.currentQuestionIndex === index) {
      speakWord(q.english_word);
    }
  }, 200);
}

function nextQuestion() {
  try {
    // Clear interval immediately when moving forward
    clearInterval(state.timerInterval);

    const currentQuestion = state.questions[state.currentQuestionIndex];
    if (!currentQuestion) {
      showToast('Lỗi: Thiếu dữ liệu câu hỏi hiện tại.', 'error');
      return;
    }

    const studentEnglish = (elements.inputStudentEnglish.value || '').trim();
    const studentVietnamese = (elements.inputStudentVietnamese.value || '').trim();

    // Auto-submission is allowed in test mode if time expires, 
    // but if triggered by user click, we require at least one input in practice mode.
    if (state.timeLeft > 0 && !studentEnglish && !studentVietnamese) {
      showToast('Vui lòng gõ câu trả lời trước khi chuyển tiếp.', 'info');
      return;
    }

    // Answer matching with safety fallbacks
    const correctEnglish = (currentQuestion.english_word || '').toLowerCase().trim();
    const correctVietnamese = (currentQuestion.vietnamese_word || '').toLowerCase().trim();

    const isEnglishCorrect = (studentEnglish.toLowerCase() === correctEnglish);
    const isVietnameseCorrect = (studentVietnamese.toLowerCase() === correctVietnamese);
    const isCorrect = isEnglishCorrect && isVietnameseCorrect;

    state.studentAnswers[state.currentQuestionIndex] = {
      questionId: currentQuestion.id,
      studentEnglish: studentEnglish,
      studentVietnamese: studentVietnamese,
      isCorrect: isCorrect,
      isEnglishCorrect: isEnglishCorrect,
      isVietnameseCorrect: isVietnameseCorrect
    };

    // Go to next question
    state.currentQuestionIndex++;
    
    if (state.currentQuestionIndex < state.questions.length) {
      showQuestion(state.currentQuestionIndex);
    } else {
      // Run AI Grading
      runAIGrading();
    }
  } catch (error) {
    console.error('Error in nextQuestion:', error);
    showToast(`Lỗi ứng dụng: ${error.message}`, 'error');
  }
}

// ==========================================================================
// Results & Evaluation
// ==========================================================================
function showResults() {
  clearInterval(state.timerInterval);
  switchView('view-results');
  
  // Set progress fill to 100% on completion
  elements.quizProgressFill.style.width = `100%`;

  const trueCount = state.score;
  const falseCount = state.questions.length - state.score;
  const percentage = Math.round((trueCount / state.questions.length) * 100);

  elements.resultsScoreTrue.innerText = trueCount;
  elements.resultsScoreFalse.innerText = falseCount;

  // Grade styling and messages
  let headline = 'Hoàn Thành!';
  let iconName = 'trophy';
  
  if (percentage === 100) {
    headline = 'Xuất Sắc! Điểm tuyệt đối! 🏆';
    iconName = 'award';
  } else if (percentage >= 80) {
    headline = 'Làm Tốt Lắm! 🌟';
    iconName = 'thumbs-up';
  } else if (percentage >= 50) {
    headline = 'Có Cố Gắng! Hãy tiếp tục ôn luyện nhé. 👍';
    iconName = 'smile';
  } else {
    headline = 'Cố Gắng Lên! Luyện tập nhiều con sẽ tiến bộ. 💪';
    iconName = 'rotate-ccw';
  }

  elements.resultsHeadline.innerText = headline;
  elements.resultsBadgeIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons();

  // Render Detailed review list
  elements.resultsReviewList.innerHTML = '';
  state.questions.forEach((q, idx) => {
    const record = state.studentAnswers[idx];
    const isCorrect = record ? record.isCorrect : false;
    const isEnglishCorrect = record ? record.isEnglishCorrect : false;
    const isVietnameseCorrect = record ? record.isVietnameseCorrect : false;
    const feedbackStr = record && record.vietnameseFeedback ? record.vietnameseFeedback : '';

    const studentEngStr = record ? record.studentEnglish : 'None';
    const studentVieStr = record ? record.studentVietnamese : 'None';

    const item = document.createElement('div');
    item.className = `review-item ${isCorrect ? 'correct' : 'incorrect'}`;
    
    item.innerHTML = `
      <div class="review-content">
        <div class="review-words">
          <span>Đáp án đúng: ${q.english_word}</span>
          <span style="font-weight: normal; color: var(--text-muted); font-size: 0.9em; font-family: monospace; margin: 0 0.5rem;">${q.pronunciation}</span>
          <span style="font-weight: 500; color: var(--text-secondary);">&rarr; ${q.vietnamese_word}</span>
        </div>
        <div class="review-your-answer">
          Bài làm của con: 
          Tiếng Anh: <span class="${isEnglishCorrect ? 'text-success' : 'text-error'}">${escapeHtml(studentEngStr || 'để trống')}</span> | 
          Tiếng Việt: <span class="${isVietnameseCorrect ? 'text-success' : 'text-error'}">${escapeHtml(studentVieStr || 'để trống')}</span>
        </div>
        ${feedbackStr ? `<div class="review-ai-feedback mt-xs" style="font-size: 0.85rem; color: #a5b4fc; font-style: italic; border-left: 2px solid #8b5cf6; padding-left: 0.5rem; margin-top: 0.25rem;">
          🤖 Trợ lý AI: ${escapeHtml(feedbackStr)}
        </div>` : ''}
      </div>
      <button class="btn btn-secondary btn-icon-only btn-circle btn-sm-speak" data-word="${q.english_word}" title="Re-listen">
        <i data-lucide="volume-2" style="width: 18px; height: 18px;"></i>
      </button>
      <i class="review-status-icon" data-lucide="${isCorrect ? 'check' : 'x'}"></i>
    `;

    // Listen to speak click
    item.querySelector('.btn-sm-speak').addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(q.english_word);
    });

    elements.resultsReviewList.appendChild(item);
  });
  lucide.createIcons();
}

async function runAIGrading() {
  switchView('view-grading');
  
  try {
    // Gather all answers
    const gradingPayload = state.questions.map((q, idx) => {
      const ans = state.studentAnswers[idx];
      return {
        question_id: q.id,
        english_word: q.english_word,
        expected_vietnamese: q.vietnamese_word,
        student_vietnamese: ans ? ans.studentVietnamese : ''
      };
    });

    const responseSchema = {
      type: "OBJECT",
      properties: {
        evaluations: {
          type: "ARRAY",
          description: "List of graded Vietnamese answers",
          items: {
            type: "OBJECT",
            properties: {
              question_id: { type: "INTEGER", description: "The ID of the graded question" },
              vietnamese_status: { type: "STRING", enum: ["correct", "incorrect"], description: "Whether the student's translation is correct, semantically equivalent, or an accurate synonym" },
              vietnamese_feedback: { type: "STRING", description: "Short feedback message in Vietnamese, e.g. explaining if synonym was accepted or why it is wrong" }
            },
            required: ["question_id", "vietnamese_status", "vietnamese_feedback"]
          }
        }
      },
      required: ["evaluations"]
    };

    const systemInstruction = `You are a professional bilingual English-Vietnamese grading assistant.
Your task is to grade the student's Vietnamese vocabulary translation answer.
For each item in the payload, you are given:
- question_id
- english_word (the target English word)
- expected_vietnamese (the primary translation)
- student_vietnamese (what the student typed)

Your criteria:
1. If the student left it blank, mark it as "incorrect" with feedback like "Chưa có câu trả lời.".
2. Determine if the student's Vietnamese translation is semantically correct, accurate, or a valid synonym for the English word. For example, if the English word is "tortoise" (primary: "con rùa"), and the student typed "rùa", "rùa cạn", or "rùa đất", mark it as "correct" because it is a correct translation. 
3. If they made a minor typo in Vietnamese but it's clearly recognizable and correct, you may mark it as "correct" and note the typo.
4. If it means something completely different, mark it as "incorrect" with a helpful tip explaining the correct meaning.

Always respond in valid JSON matching the specified schema.`;

    const requestBody = {
      contents: [{
        parts: [{ text: `Payload to grade: ${JSON.stringify(gradingPayload)}` }]
      }],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    };

    if (state.apiKey) {
      // Local client-side call
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Empty response from grading model.");

      const gradingResult = JSON.parse(rawText);
      applyGradingResults(gradingResult.evaluations);
    } else {
      // Serverless backend call
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload: gradingPayload })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error || errData.message || response.statusText || 'Backend server failed to grade answers.';
        throw new Error(errMsg);
      }

      const gradingResult = await response.json();
      applyGradingResults(gradingResult.evaluations);
    }

  } catch (error) {
    console.error('Error during AI grading:', error);
    showToast(`Hệ thống AI bận, tự động chuyển sang so khớp từ vựng chính xác. Chi tiết: ${error.message}`, 'error');
    
    // Fallback: If AI fails, use fallback exact matching to ensure the app doesn't break
    fallbackGrading();
  }
}

function applyGradingResults(evaluations) {
  state.score = 0;

  evaluations.forEach(evalItem => {
    const qIndex = state.questions.findIndex(q => q.id === evalItem.question_id);
    if (qIndex !== -1) {
      const record = state.studentAnswers[qIndex];
      const currentQuestion = state.questions[qIndex];
      if (record && currentQuestion) {
        const isEnglishCorrect = record.isEnglishCorrect;
        const isVietnameseCorrect = (evalItem.vietnamese_status === 'correct');
        const isCorrect = isEnglishCorrect && isVietnameseCorrect;

        // Update the record in state
        record.isCorrect = isCorrect;
        record.isVietnameseCorrect = isVietnameseCorrect;
        record.vietnameseFeedback = evalItem.vietnamese_feedback;

        if (isCorrect) {
          state.score++;
        }
      }
    }
  });

  showResults();
}

function fallbackGrading() {
  state.score = 0;
  state.studentAnswers.forEach((record, idx) => {
    const q = state.questions[idx];
    if (q && record) {
      // Re-evaluate using local exact matching
      const correctEnglish = q.english_word.toLowerCase().trim();
      const correctVietnamese = q.vietnamese_word.toLowerCase().trim();

      const isEnglishCorrect = ((record.studentEnglish || '').toLowerCase() === correctEnglish);
      const isVietnameseCorrect = ((record.studentVietnamese || '').toLowerCase() === correctVietnamese);
      const isCorrect = isEnglishCorrect && isVietnameseCorrect;

      record.isCorrect = isCorrect;
      record.isEnglishCorrect = isEnglishCorrect;
      record.isVietnameseCorrect = isVietnameseCorrect;
      record.vietnameseFeedback = isVietnameseCorrect 
        ? 'Chính xác' 
        : `Chưa chính xác hoàn toàn. Nghĩa dịch đúng: "${q.vietnamese_word}"`;

      if (isCorrect) {
        state.score++;
      }
    }
  });

  showResults();
}

function retryQuiz() {
  startQuiz();
}

function prevQuestion() {
  if (state.timerMode !== 'practice') return;

  // Save current answers to state before going back
  const currentQuestion = state.questions[state.currentQuestionIndex];
  if (currentQuestion) {
    const studentEnglish = (elements.inputStudentEnglish.value || '').trim();
    const studentVietnamese = (elements.inputStudentVietnamese.value || '').trim();
    
    const correctEnglish = (currentQuestion.english_word || '').toLowerCase().trim();
    const correctVietnamese = (currentQuestion.vietnamese_word || '').toLowerCase().trim();

    const isEnglishCorrect = (studentEnglish.toLowerCase() === correctEnglish);
    const isVietnameseCorrect = (studentVietnamese.toLowerCase() === correctVietnamese);
    const isCorrect = isEnglishCorrect && isVietnameseCorrect;

    state.studentAnswers[state.currentQuestionIndex] = {
      questionId: currentQuestion.id,
      studentEnglish: studentEnglish,
      studentVietnamese: studentVietnamese,
      isCorrect: isCorrect,
      isEnglishCorrect: isEnglishCorrect,
      isVietnameseCorrect: isVietnameseCorrect
    };
  }

  if (state.currentQuestionIndex > 0) {
    state.currentQuestionIndex--;
    showQuestion(state.currentQuestionIndex);
  }
}

// ==========================================================================
// Quiz Saving & Sharing API Calls
// ==========================================================================
async function saveQuiz() {
  if (state.questions.length === 0) return;
  
  elements.btnShareQuiz.disabled = true;
  const originalContent = elements.btnShareQuiz.innerHTML;
  elements.btnShareQuiz.innerHTML = `<span class="spinner" style="width:16px; height:16px; margin:0; display:inline-block; border-width:2px; vertical-align:middle;"></span> Đang lưu...`;
  
  const quizDataObj = {
    title: elements.quizPreviewTitle.innerText || 'Đề Ôn Tập Từ Vựng',
    questions: state.questions
  };
  
  const tempId = 'local_' + Math.random().toString(36).substring(2, 10);
  
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quizDataObj)
    });
    
    if (!response.ok) {
      throw new Error(`Server returned status code ${response.status}`);
    }
    
    const resData = await response.json();
    if (!resData.id) throw new Error('Mã ID của đề bị trống.');
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?quiz=${resData.id}`;
    elements.shareLinkInput.value = shareUrl;
    elements.shareLinkContainer.style.display = 'block';
    
    showToast('Lưu đề thành công! Sao chép liên kết để gửi cho ba mẹ.', 'success');
  } catch (error) {
    console.warn('Backend API not available, saving to localStorage:', error);
    
    // Fallback: Store quiz data directly in localStorage
    localStorage.setItem(tempId, JSON.stringify(quizDataObj));
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?quiz=${tempId}`;
    elements.shareLinkInput.value = shareUrl;
    elements.shareLinkContainer.style.display = 'block';
    
    showToast('Lưu đề thành công (lưu cục bộ trên trình duyệt máy bạn)!', 'success');
  } finally {
    elements.btnShareQuiz.disabled = false;
    elements.btnShareQuiz.innerHTML = originalContent;
    lucide.createIcons();
  }
}

function copyShareLink() {
  const input = elements.shareLinkInput;
  if (!input.value) return;
  
  input.select();
  input.setSelectionRange(0, 99999);
  
  navigator.clipboard.writeText(input.value)
    .then(() => {
      showToast('Đã sao chép liên kết vào bộ nhớ!', 'success');
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
      showToast('Lỗi khi sao chép liên kết.', 'error');
    });
}

async function loadSharedQuiz(quizId) {
  switchView('view-loading-quiz');
  elements.btnToggleView.style.display = 'none';
  
  // Try loading from localStorage first if it's a local ID
  if (quizId.startsWith('local_')) {
    const localData = localStorage.getItem(quizId);
    if (localData) {
      try {
        const data = JSON.parse(localData);
        state.questions = data.questions;
        elements.quizPreviewTitle.innerText = data.title || 'Đề Ôn Tập Từ Vựng';
        // Go to mode selection
        elements.btnToggleView.style.display = 'inline-flex';
        switchView('view-mode-selection');
        showToast('Đã tải đề ôn tập từ bộ nhớ trình duyệt!', 'success');
        return;
      } catch (err) {
        console.error('Failed to parse local quiz:', err);
      }
    }
  }
  
  try {
    const response = await fetch(`/api/load?id=${quizId}`);
    if (!response.ok) {
      // Secondary fallback check for localStorage in case of standard ID offline
      const localData = localStorage.getItem(quizId);
      if (localData) {
        const data = JSON.parse(localData);
        state.questions = data.questions;
        elements.quizPreviewTitle.innerText = data.title || 'Đề Ôn Tập Từ Vựng';
        // Go to mode selection
        elements.btnToggleView.style.display = 'inline-flex';
        switchView('view-mode-selection');
        showToast('Đã tải đề ôn tập từ bộ nhớ trình duyệt!', 'success');
        return;
      }
      throw new Error('Đề ôn tập này không tồn tại hoặc đã bị xóa.');
    }
    
    const data = await response.json();
    if (!data.questions || data.questions.length === 0) {
      throw new Error('Đề bài ôn tập trống hoặc định dạng bị lỗi.');
    }
    
    state.questions = data.questions;
    elements.quizPreviewTitle.innerText = data.title || 'Đề Ôn Tập Từ Vựng';
    
    // Go to mode selection
    elements.btnToggleView.style.display = 'inline-flex';
    switchView('view-mode-selection');
    showToast('Đã tải đề ôn tập từ máy chủ!', 'success');
  } catch (error) {
    console.error('Error loading quiz:', error);
    showToast(`Lỗi: ${error.message}`, 'error');
    setTimeout(() => {
      switchView('view-teacher');
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 3000);
  }
}

// ==========================================================================
// Helpers
// ==========================================================================
function showToast(message, type = 'info') {
  // Create toast container if not exists
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Set Icon
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);
  lucide.createIcons();

  // Trigger entering animation transition
  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);

  // Clear toast
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 300);
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// CSS injection for Toasts (keeps style.css clean or ensures toasts work)
const style = document.createElement('style');
style.textContent = `
  .toast-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    z-index: 2000;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(18, 14, 38, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    padding: 1rem 1.5rem;
    border-radius: var(--border-radius-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    transform: translateY(20px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 350px;
    font-weight: 500;
  }
  .toast.visible {
    transform: translateY(0);
    opacity: 1;
  }
  .toast-success {
    border-left: 4px solid var(--color-success);
  }
  .toast-success i {
    color: var(--color-success);
  }
  .toast-error {
    border-left: 4px solid var(--color-error);
  }
  .toast-error i {
    color: var(--color-error);
  }
  .toast-info {
    border-left: 4px solid var(--color-secondary);
  }
  .toast-info i {
    color: var(--color-secondary);
  }
`;
document.head.appendChild(style);
