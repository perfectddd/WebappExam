/**
 * WebappExam Frontend Logic - app.js
 * Implements SPA navigation, state management, timer synchronization,
 * API requests, shuffling, and Guided Feedback.
 * Includes a built-in Offline Demo Mode for instant testing without a backend.
 */

// --- APPLICATION STATE ---
let apiURL = localStorage.getItem('webapp_exam_api_url') || '';
let studentSession = JSON.parse(localStorage.getItem('webapp_exam_session')) || null;
let quizState = null;
let timerInterval = null;

// --- DOM ELEMENTS ---
const screens = {
  login: document.getElementById('section-login'),
  dashboard: document.getElementById('section-dashboard'),
  quiz: document.getElementById('section-quiz'),
  result: document.getElementById('section-result')
};

const header = document.getElementById('global-header');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');

// Login Elements
const loginForm = document.getElementById('login-form');
const loginStudentId = document.getElementById('login-student-id');
const loginPassword = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginErrorMsg = document.getElementById('login-error-msg');
const triggerSettingsBtn = document.getElementById('trigger-settings-btn');

// Dashboard Elements
const dashboardWelcomeUser = document.getElementById('dashboard-welcome-user');
const dashboardSettingsBtn = document.getElementById('dashboard-settings-btn');
const subjectsContainer = document.getElementById('subjects-container');
const dashboardStatusBanner = document.getElementById('dashboard-status-banner');
const leaderboardBody = document.getElementById('leaderboard-body');

// Quiz Elements
const quizSubjectDisplay = document.getElementById('quiz-subject-display');
const quizModeBadge = document.getElementById('quiz-mode-badge');
const quizProgressText = document.getElementById('quiz-progress-text');
const quizTimerBox = document.getElementById('quiz-timer-box');
const quizTimeLeft = document.getElementById('quiz-time-left');
const quizProgressBar = document.getElementById('quiz-progress-bar');
const quizQuestionText = document.getElementById('quiz-question-text');
const quizChoicesContainer = document.getElementById('quiz-choices-container');
const quizPrevBtn = document.getElementById('quiz-prev-btn');
const quizNextBtn = document.getElementById('quiz-next-btn');

// Result Elements
const resultIcon = document.getElementById('result-icon');
const resultHeadline = document.getElementById('result-headline');
const resultSubjectName = document.getElementById('result-subject-name');
const resultScoreCircle = document.getElementById('result-score-circle');
const resultScoreText = document.getElementById('result-score-text');
const resultStatusBadge = document.getElementById('result-status-badge');
const feedbackContentArea = document.getElementById('feedback-content-area');
const resultRetryWrongBtn = document.getElementById('result-retry-wrong-btn');
const resultHomeBtn = document.getElementById('result-home-btn');

// Settings Modal Elements
const settingsModal = document.getElementById('settings-modal');
const settingsApiUrl = document.getElementById('settings-api-url');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');

// --- MOCK DATA FOR DEMO MODE ---
const MOCK_USERS = [
  { id: '66010123', password: 'pass1234', name: 'สมชาย รักเรียน (นักเรียนนายร้อย)' },
  { id: '66010124', password: 'pass1234', name: 'สมศรี ขยันยิ่ง (นักเรียนพยาบาลทหารบก)' },
  { id: 'admin', password: 'admin', name: 'ร.อ. วิงเวียน ศีรษะ (ผู้คุมสอบ)' }
];

const MOCK_SUBJECTS = [
  { subjectCode: 'MATH01', subjectName: 'คณิตศาสตร์พื้นฐาน (ทบ.)' },
  { subjectCode: 'ENGL01', subjectName: 'ภาษาอังกฤษเฉพาะทางทหาร' }
];

const MOCK_QUESTIONS = {
  MATH01: [
    { questionId: 'Q-MATH-001', questionText: 'ถ้า 5 x 5 = 25 แล้ว 5 x 5 x 5 มีค่าเท่ากับเท่าใด?', choices: ['50', '125', '75', '100'], correctAnswer: '125', topic: 'การคูณเลขยกกำลัง', rationale: '5 x 5 x 5 คือ 25 x 5 ซึ่งเท่ากับ 125' },
    { questionId: 'Q-MATH-002', questionText: 'ผลรวมของเศษส่วน 1/2 + 1/4 มีค่าเท่ากับข้อใด?', choices: ['2/6', '3/4', '1/3', '2/3'], correctAnswer: '3/4', topic: 'การบวกเศษส่วน', rationale: 'ต้องทำส่วนให้เท่ากันก่อน: 1/2 แปลงเป็น 2/4 จากนั้น 2/4 + 1/4 = 3/4' },
    { questionId: 'Q-MATH-003', questionText: 'มุมฉาก (Right Angle) มีขนาดคงที่กี่องศา?', choices: ['45 องศา', '90 องศา', '180 องศา', '360 องศา'], correctAnswer: '90 องศา', topic: 'เรขาคณิตพื้นฐาน', rationale: 'มุมฉากมีขนาด 90 องศาพอดี ส่วน 180 องศาคือมุมตรง' },
    { questionId: 'Q-MATH-004', questionText: 'สมการ 2x + 5 = 15 ค่าของ x คือข้อใด?', choices: ['5', '10', '7', '8'], correctAnswer: '5', topic: 'สมการเชิงเส้น', rationale: 'ย้าย 5 ไปลบ: 2x = 10 จากนั้นย้าย 2 ไปหาร: x = 10 / 2 = 5' },
    { questionId: 'Q-MATH-005', questionText: 'ค่าเฉลี่ยเลขคณิตของ 2, 4, 6, 8, 10 คือข้อใด?', choices: ['5', '6', '7', '8'], correctAnswer: '6', topic: 'สถิติเบื้องต้น', rationale: 'ผลรวมของเลขคือ 2+4+6+8+10 = 30 หารด้วยจำนวนข้อมูล 5 ตัว จะได้ 30 / 5 = 6' },
    { questionId: 'Q-MATH-006', questionText: 'ตัวประกอบทั้งหมดของ 12 มีรวมกันกี่ตัว?', choices: ['4 ตัว', '5 ตัว', '6 ตัว', '8 ตัว'], correctAnswer: '6 ตัว', topic: 'จำนวนนับ', rationale: 'ตัวประกอบคือตัวเลขที่หาร 12 ลงตัว ได้แก่ 1, 2, 3, 4, 6, 12 รวมเป็น 6 ตัว' },
    { questionId: 'Q-MATH-007', questionText: '15% ของเงิน 200 บาท คิดเป็นกี่บาท?', choices: ['20 บาท', '25 บาท', '30 บาท', '35 บาท'], correctAnswer: '30 บาท', topic: 'ร้อยละและเปอร์เซ็นต์', rationale: 'คิดจากสูตร (15 / 100) x 200 = 15 x 2 = 30 บาท' },
    { questionId: 'Q-MATH-008', questionText: 'สูตรในการหาพื้นที่ของวงกลมคือข้อใด?', choices: ['2πr', 'πr²', 'πd', '2πr²'], correctAnswer: 'πr²', topic: 'สูตรพื้นที่เรขาคณิต', rationale: 'สูตรพื้นที่คือ πr² ส่วน 2πr คือสูตรความยาวเส้นรอบวง' },
    { questionId: 'Q-MATH-009', questionText: 'ผลคูณของ ห.ร.ม. และ ค.ร.น. ของ 6 และ 8 มีค่าเท่าใด?', choices: ['14', '24', '48', '96'], correctAnswer: '48', topic: 'ห.ร.ม. และ ค.ร.น.', rationale: 'ห.ร.ม. ของ 6 และ 8 คือ 2, ค.ร.น. คือ 24 ผลคูณคือ 2 x 24 = 48 (หรือคิดจากสูตร ผลคูณของสองจำนวน = 6 x 8 = 48)' },
    { questionId: 'Q-MATH-010', questionText: 'สี่เหลี่ยมจัตุรัสมีความยาวรอบรูป 24 ซม. จะมีพื้นที่เท่าใด?', choices: ['24 ตร.ซม.', '36 ตร.ซม.', '48 ตร.ซม.', '144 ตร.ซม.'], correctAnswer: '36 ตร.ซม.', topic: 'เรขาคณิตพื้นฐาน', rationale: 'ความยาวแต่ละด้าน = 24 / 4 = 6 ซม. พื้นที่ = ด้าน x ด้าน = 6 x 6 = 36 ตารางเซนติเมตร' }
  ],
  ENGL01: [
    { questionId: 'Q-ENGL-001', questionText: 'Choose the correct form: She _____ to the army camp every morning.', choices: ['go', 'goes', 'going', 'went'], correctAnswer: 'goes', topic: 'Tense - Present Simple', rationale: 'ประธานเอกพจน์บุรุษที่ 3 (She) กริยาใน Present Simple ต้องเติม s/es' },
    { questionId: 'Q-ENGL-002', questionText: 'What is the synonym of the word "Quick"?', choices: ['Slow', 'Fast', 'Heavy', 'Smart'], correctAnswer: 'Fast', topic: 'คำศัพท์ (Vocabulary)', rationale: 'Synonym ของ Quick คือ Fast ซึ่งแปลว่า รวดเร็ว เหมือนกัน' },
    { questionId: 'Q-ENGL-003', questionText: 'Which word is a noun?', choices: ['Beautiful', 'Officer', 'Quickly', 'Defend'], correctAnswer: 'Officer', topic: 'ประเภทของคำ (Parts of Speech)', rationale: 'Officer (นายทหาร/เจ้าหน้าที่) ทำหน้าที่เป็นคำนาม ส่วน Beautiful คือ adj, Quickly คือ adv, Defend คือ verb' },
    { questionId: 'Q-ENGL-004', questionText: 'If I _____ a General, I would change the training protocol.', choices: ['am', 'was', 'were', 'will be'], correctAnswer: 'were', topic: 'Conditional Sentences (If-Clause)', rationale: 'ในประโยคสมมติที่ตรงข้ามกับความเป็นจริงในปัจจุบัน (If-Clause Type 2) จะใช้ were กับประธานทุกตัว' },
    { questionId: 'Q-ENGL-005', questionText: 'They have been serving in this unit _____ 2018.', choices: ['for', 'since', 'during', 'ago'], correctAnswer: 'since', topic: 'คำบุพบทบอกเวลา (Prepositions)', rationale: 'ใช้ since นำหน้าจุดเริ่มต้นของเวลา (since 2018) ส่วน for จะใช้บอกช่วงระยะเวลารวม' }
  ]
};

let MOCK_SCORES = JSON.parse(localStorage.getItem('webapp_exam_mock_scores')) || [
  { rank: 1, name: 'ส.อ. อรัญ ใฝ่ดี', subjectName: 'คณิตศาสตร์พื้นฐาน (ทบ.)', score: 10, totalQuestions: 10, durationSeconds: 185 },
  { rank: 2, name: 'นรต. วชิรวิทย์ ตั้งใจ', subjectName: 'ภาษาอังกฤษเฉพาะทางทหาร', score: 5, totalQuestions: 5, durationSeconds: 95 },
  { rank: 3, name: 'พลทหาร อดทน เสมอ', subjectName: 'คณิตศาสตร์พื้นฐาน (ทบ.)', score: 9, totalQuestions: 10, durationSeconds: 220 },
  { rank: 4, name: 'ร.ต.หญิง มาลี แกร่งกล้า', subjectName: 'ภาษาอังกฤษเฉพาะทางทหาร', score: 4, totalQuestions: 5, durationSeconds: 110 },
  { rank: 5, name: 'สมชาย รักเรียน (นักเรียนนายร้อย)', subjectName: 'คณิตศาสตร์พื้นฐาน (ทบ.)', score: 8, totalQuestions: 10, durationSeconds: 312 }
];

// --- HELPER FUNCTIONS ---

// Switch screens with smooth animation
function showScreen(screenId) {
  Object.keys(screens).forEach(key => {
    if (key === screenId) {
      screens[key].classList.add('active');
    } else {
      screens[key].classList.remove('active');
    }
  });

  // Toggle global header visibility based on screen
  if (screenId === 'login' || screenId === 'quiz') {
    header.style.display = 'none';
  } else {
    header.style.display = 'flex';
  }
}

// Show settings warning banner on dashboard if API is not set
function updateApiWarningState() {
  if (!apiURL) {
    dashboardStatusBanner.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div>⚠️ <strong>กรุณาตั้งค่า API Web App ก่อนใช้งาน:</strong> วาง URL ของ Google Apps Script ที่ปุ่ม "ตั้งค่า API" ด้านบน</div>
        <div>หรือหากท่านต้องการทดสอบความสามารถและ UX ของระบบทันที ให้เปิดโหมดทดลองใช้งานจำลองระบบหลังบ้านด้านล่าง:</div>
        <div>
          <button id="enable-demo-mode-btn" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background-color: var(--color-warning);">
            💡 เปิดใช้งานโหมดทดลอง (Demo Mode)
          </button>
        </div>
      </div>
    `;
    dashboardStatusBanner.className = 'settings-box';
    dashboardStatusBanner.style.backgroundColor = 'var(--color-warning-bg)';
    dashboardStatusBanner.style.borderColor = 'var(--color-warning)';
    dashboardStatusBanner.style.color = 'var(--color-warning)';
    dashboardStatusBanner.style.display = 'block';
    
    // Bind demo mode activation
    setTimeout(() => {
      const demoBtn = document.getElementById('enable-demo-mode-btn');
      if (demoBtn) {
        demoBtn.addEventListener('click', () => {
          apiURL = 'DEMO';
          localStorage.setItem('webapp_exam_api_url', 'DEMO');
          alert('เปิดใช้งานโหมดทดลองเรียบร้อยแล้ว!\nสามารถล็อกอินด้วย:\nรหัส: 66010123\nรหัสผ่าน: pass1234');
          updateApiWarningState();
          checkSession();
        });
      }
    }, 50);
    
    subjectsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: var(--color-warning);">กรุณาตั้งค่า API หรือเปิดโหมด Demo เพื่อโหลดข้อมูล</div>`;
    leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-warning);">กรุณาตั้งค่า API หรือเปิดโหมด Demo เพื่อโหลดตารางอันดับ</td></tr>`;
    return false;
  } else {
    dashboardStatusBanner.style.display = 'none';
    return true;
  }
}

// Check session on load
function checkSession() {
  if (studentSession) {
    userDisplayName.textContent = studentSession.name;
    dashboardWelcomeUser.textContent = `สวัสดีคุณ: ${studentSession.name}`;
    showScreen('dashboard');
    if (updateApiWarningState()) {
      loadSubjects();
      loadLeaderboard();
    }
  } else {
    showScreen('login');
  }
}

// Fetch helper that handles redirects automatically for Google Apps Script Web Apps
async function callAPI(url, options = {}) {
  // If in DEMO mode, bypass server fetch and simulate client-side API
  if (apiURL === 'DEMO') {
    return await simulateMockAPI(url, options);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API Call Failed:', error);
    throw error;
  }
}

// Array Shuffle helper (Fisher-Yates Algorithm)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- EVENT BINDINGS ---

// Open settings modal
triggerSettingsBtn.addEventListener('click', () => {
  settingsApiUrl.value = apiURL;
  settingsModal.classList.add('show');
});

dashboardSettingsBtn.addEventListener('click', () => {
  settingsApiUrl.value = apiURL;
  settingsModal.classList.add('show');
});

// Close settings modal
settingsCancelBtn.addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

// Save settings API URL
settingsSaveBtn.addEventListener('click', () => {
  const value = settingsApiUrl.value.trim();
  apiURL = value;
  localStorage.setItem('webapp_exam_api_url', value);
  settingsModal.classList.remove('show');
  
  if (studentSession) {
    if (updateApiWarningState()) {
      loadSubjects();
      loadLeaderboard();
    }
  } else {
    checkSession();
  }
});

// Submit Login Form
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!updateApiWarningState()) {
    loginErrorMsg.textContent = 'กรุณาตั้งค่า API Web App หรือเปิดโหมด Demo ก่อนเข้าสู่ระบบ';
    loginErrorMsg.style.display = 'block';
    return;
  }
  
  const studentId = loginStudentId.value.trim();
  const password = loginPassword.value.trim();
  
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = 'กำลังตรวจสอบ...';
  loginErrorMsg.style.display = 'none';
  
  try {
    const targetUrl = `${apiURL}?action=login&studentId=${encodeURIComponent(studentId)}&password=${encodeURIComponent(password)}`;
    const res = await callAPI(targetUrl);
    
    if (res.success) {
      studentSession = {
        studentId: res.studentId,
        name: res.name
      };
      localStorage.setItem('webapp_exam_session', JSON.stringify(studentSession));
      loginStudentId.value = '';
      loginPassword.value = '';
      checkSession();
    } else {
      loginErrorMsg.textContent = res.message || 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง';
      loginErrorMsg.style.display = 'block';
    }
  } catch (err) {
    loginErrorMsg.textContent = 'เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์ กรุณาตรวจสอบ URL ของ API';
    loginErrorMsg.style.display = 'block';
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'เข้าสู่ระบบ ➔';
  }
});

// Logout action
logoutBtn.addEventListener('click', () => {
  if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
    localStorage.removeItem('webapp_exam_session');
    localStorage.removeItem('webapp_exam_state');
    studentSession = null;
    quizState = null;
    if (timerInterval) clearInterval(timerInterval);
    showScreen('login');
  }
});

// Home button in Results screen
resultHomeBtn.addEventListener('click', () => {
  showScreen('dashboard');
  if (updateApiWarningState()) {
    loadSubjects();
    loadLeaderboard();
  }
});

// --- CORE LOGIC: FETCH DASHBOARD DATA ---

// Load subjects dynamically
async function loadSubjects() {
  subjectsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: var(--color-text-muted);">กำลังโหลดรายชื่อวิชา...</div>`;
  
  try {
    const targetUrl = `${apiURL}?action=getSubjects`;
    const res = await callAPI(targetUrl);
    
    if (res.success) {
      if (res.subjects.length === 0) {
        subjectsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: var(--color-text-muted);">ไม่มีรายชื่อวิชาที่เปิดสอบในขณะนี้</div>`;
        return;
      }
      
      subjectsContainer.innerHTML = '';
      res.subjects.forEach(subject => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        
        card.innerHTML = `
          <div class="subject-code">${subject.subjectCode}</div>
          <div class="subject-name">${subject.subjectName}</div>
          <div class="quiz-config">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem; margin-bottom: 4px;">จำนวนข้อที่ต้องการทำ:</label>
              <select class="form-control question-limit-select" style="padding: 6px 12px; font-size: 0.9rem;">
                <option value="5">5 ข้อ</option>
                <option value="10">10 ข้อ (แนะนำ)</option>
                <option value="20">20 ข้อ</option>
                <option value="30">30 ข้อ</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size: 0.8rem; margin-bottom: 4px;">รูปแบบประเมินผล:</label>
              <div class="mode-selector">
                <button class="mode-btn active" data-mode="Exam">สอบจริง (Exam)</button>
                <button class="mode-btn" data-mode="Practice">ฝึกซ้อม (Practice)</button>
              </div>
            </div>
            <button class="btn btn-primary start-quiz-btn" style="width: 100%; padding: 8px 16px; font-size: 0.9rem; margin-top: 5px;">
              เริ่มทำข้อสอบ ⚡
            </button>
          </div>
        `;
        
        // Mode toggle interaction
        const modeButtons = card.querySelectorAll('.mode-btn');
        let selectedMode = 'Exam';
        modeButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedMode = btn.dataset.mode;
          });
        });
        
        // Start Quiz action
        const startBtn = card.querySelector('.start-quiz-btn');
        const limitSelect = card.querySelector('.question-limit-select');
        startBtn.addEventListener('click', () => {
          const limit = parseInt(limitSelect.value, 10);
          if (confirm(`คุณต้องการเริ่มทำข้อสอบวิชา ${subject.subjectName} (${selectedMode === 'Exam' ? 'โหมดสอบจริง' : 'โหมดฝึกซ้อม'}) จำนวน ${limit} ข้อ ใช่หรือไม่?`)) {
            startQuiz(subject.subjectCode, subject.subjectName, selectedMode, limit);
          }
        });
        
        subjectsContainer.appendChild(card);
      });
    } else {
      subjectsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: var(--color-error);">${res.message || 'ไม่สามารถดึงข้อมูลวิชาได้'}</div>`;
    }
  } catch (err) {
    subjectsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: var(--color-error);">เกิดข้อผิดพลาดในการโหลดวิชา กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</div>`;
  }
}

// Load Leaderboard dynamically
async function loadLeaderboard() {
  leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 30px;">กำลังโหลดตารางอันดับ...</td></tr>`;
  
  try {
    const targetUrl = `${apiURL}?action=getLeaderboard`;
    const res = await callAPI(targetUrl);
    
    if (res.success) {
      if (res.leaderboard.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 30px;">ยังไม่มีข้อมูลประวัติผู้เข้าสอบในบอร์ดคะแนน</td></tr>`;
        return;
      }
      
      leaderboardBody.innerHTML = '';
      res.leaderboard.forEach(record => {
        const row = document.createElement('tr');
        row.className = `rank-${record.rank}`;
        
        // Format time taken
        const min = Math.floor(record.durationSeconds / 60);
        const sec = record.durationSeconds % 60;
        const timeFormatted = `${min} นาที ${sec} วินาที`;
        
        row.innerHTML = `
          <td><span class="rank-badge">${record.rank}</span></td>
          <td style="font-weight: 600;">${record.name}</td>
          <td>${record.subjectName}</td>
          <td style="font-weight: 700; color: var(--color-primary);">${record.score} / ${record.totalQuestions}</td>
          <td>${timeFormatted}</td>
        `;
        leaderboardBody.appendChild(row);
      });
    } else {
      leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-error); padding: 30px;">ไม่สามารถโหลดบอร์ดคะแนนได้: ${res.message}</td></tr>`;
    }
  } catch (err) {
    leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-error); padding: 30px;">เกิดข้อผิดพลาดในการสื่อสารกับระบบ Leaderboard</td></tr>`;
  }
}

// --- CORE LOGIC: PLAYING THE QUIZ ---

// Initialize and start a new quiz session
async function startQuiz(subjectCode, subjectName, mode, questionLimit, existingQuestions = null) {
  showScreen('quiz');
  quizSubjectDisplay.textContent = `วิชา: ${subjectName}`;
  quizModeBadge.textContent = mode === 'Exam' ? 'สอบจริง (Exam)' : 'ฝึกซ้อม (Practice)';
  quizProgressBar.style.width = '0%';
  quizProgressText.textContent = 'กำลังดาวน์โหลดข้อสอบ...';
  quizQuestionText.textContent = 'กรุณารอซักครู่...';
  quizChoicesContainer.innerHTML = '';
  quizPrevBtn.disabled = true;
  quizNextBtn.disabled = true;
  
  if (timerInterval) clearInterval(timerInterval);
  
  try {
    let finalQuestions = [];
    
    if (existingQuestions && existingQuestions.length > 0) {
      // Re-attempting specific questions
      finalQuestions = existingQuestions;
    } else {
      // Load all questions from database API
      const targetUrl = `${apiURL}?action=getQuestions&subjectCode=${encodeURIComponent(subjectCode)}`;
      const res = await callAPI(targetUrl);
      
      if (!res.success) {
        throw new Error(res.message || 'โหลดข้อสอบไม่สำเร็จ');
      }
      
      if (res.questions.length === 0) {
        alert('วิชานี้ยังไม่มีคำถามในคลังข้อสอบ กรุณาติดต่อผู้ดูแลระบบ');
        showScreen('dashboard');
        return;
      }
      
      // 1. Shuffle Questions
      const shuffledQ = shuffleArray(res.questions);
      
      // 2. Shuffle Choices for each question
      shuffledQ.forEach(q => {
        q.choices = shuffleArray(q.choices);
      });
      
      // 3. Slice to selected limit
      finalQuestions = shuffledQ.slice(0, Math.min(shuffledQ.length, questionLimit));
    }
    
    // Set up timer (1.5 minutes per question = 90s)
    const durationSeconds = finalQuestions.length * 90;
    
    // Save to state
    quizState = {
      subjectCode: subjectCode,
      subjectName: subjectName,
      mode: mode,
      questions: finalQuestions,
      answers: {},
      currentIndex: 0,
      startEpoch: Date.now(),
      durationSeconds: durationSeconds,
      isReattempt: existingQuestions ? true : false
    };
    
    // Save state to localStorage to prevent refresh loss (Anti-F5)
    localStorage.setItem('webapp_exam_state', JSON.stringify(quizState));
    
    // Begin timer countdown loop
    startTimer();
    
    // Load first question
    renderQuestion();
    
  } catch (err) {
    alert(`เกิดข้อผิดพลาดในการเริ่มทำข้อสอบ: ${err.message}`);
    showScreen('dashboard');
  }
}

// Render the active question on screen
function renderQuestion() {
  if (!quizState || quizState.questions.length === 0) return;
  
  const currentIdx = quizState.currentIndex;
  const total = quizState.questions.length;
  const q = quizState.questions[currentIdx];
  
  // Update progress elements
  quizProgressText.textContent = `ข้อ ${currentIdx + 1} จาก ${total}`;
  const progressPercent = ((currentIdx) / total) * 100;
  quizProgressBar.style.width = `${progressPercent}%`;
  
  // Render question text
  quizQuestionText.textContent = `โจทย์ข้อที่ ${currentIdx + 1}: ${q.questionText}`;
  
  // Render choices
  quizChoicesContainer.innerHTML = '';
  
  const savedAnswer = quizState.answers[q.questionId] || '';
  
  q.choices.forEach((choice, index) => {
    const choiceItem = document.createElement('label');
    choiceItem.className = `choice-item ${savedAnswer === choice ? 'selected' : ''}`;
    
    const labelChar = ['ก.', 'ข.', 'ค.', 'ง.'][index] || '';
    
    choiceItem.innerHTML = `
      <input type="radio" name="quiz-choice" value="${choice}" ${savedAnswer === choice ? 'checked' : ''}>
      <span class="choice-custom-radio"></span>
      <span class="choice-text"><strong>${labelChar}</strong> ${choice}</span>
    `;
    
    // Bind click trigger for visually selecting card border
    const radio = choiceItem.querySelector('input[type="radio"]');
    radio.addEventListener('change', () => {
      document.querySelectorAll('.choice-item').forEach(c => c.classList.remove('selected'));
      choiceItem.classList.add('selected');
      saveAnswer();
    });
    
    quizChoicesContainer.appendChild(choiceItem);
  });
  
  // Update buttons state
  quizPrevBtn.disabled = currentIdx === 0;
  
  if (currentIdx === total - 1) {
    quizNextBtn.innerHTML = 'ส่งคำตอบ ➔';
    quizNextBtn.className = 'btn btn-primary';
    quizNextBtn.style.backgroundColor = 'var(--color-success)';
  } else {
    quizNextBtn.innerHTML = 'ถัดไป ►';
    quizNextBtn.className = 'btn btn-primary';
    quizNextBtn.style.backgroundColor = '';
  }
  
  quizNextBtn.disabled = false;
}

// Save the user's selected choice to state and sync to localStorage
function saveAnswer() {
  if (!quizState) return;
  const currentQ = quizState.questions[quizState.currentIndex];
  const checkedRadio = document.querySelector('input[name="quiz-choice"]:checked');
  
  if (checkedRadio) {
    quizState.answers[currentQ.questionId] = checkedRadio.value;
    localStorage.setItem('webapp_exam_state', JSON.stringify(quizState));
  }
}

// Navigation triggers
quizPrevBtn.addEventListener('click', () => {
  saveAnswer();
  if (quizState && quizState.currentIndex > 0) {
    quizState.currentIndex--;
    renderQuestion();
  }
});

quizNextBtn.addEventListener('click', () => {
  saveAnswer();
  if (!quizState) return;
  
  const total = quizState.questions.length;
  if (quizState.currentIndex === total - 1) {
    // Last question -> Submit
    if (confirm('คุณมั่นใจในการส่งกระดาษคำตอบใช่หรือไม่?')) {
      submitQuiz();
    }
  } else {
    quizState.currentIndex++;
    renderQuestion();
  }
});

// Timer Loop
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  const tick = () => {
    if (!quizState) return;
    
    const elapsedSeconds = Math.floor((Date.now() - quizState.startEpoch) / 1000);
    const timeLeft = quizState.durationSeconds - elapsedSeconds;
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      quizTimeLeft.textContent = '00:00';
      alert('หมดเวลาทำข้อสอบแล้ว! ระบบจะทำการส่งข้อสอบของคุณโดยอัตโนมัติ');
      submitQuiz();
      return;
    }
    
    // Style timer if running out (< 30 seconds)
    if (timeLeft <= 30) {
      quizTimerBox.classList.add('urgent');
    } else {
      quizTimerBox.classList.remove('urgent');
    }
    
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    quizTimeLeft.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  
  tick(); // Initial tick
  timerInterval = setInterval(tick, 1000);
}

// Submit answers to backend API
async function submitQuiz() {
  if (timerInterval) clearInterval(timerInterval);
  
  if (!quizState) {
    showScreen('dashboard');
    return;
  }
  
  // Calculate total duration taken
  const elapsedSeconds = Math.floor((Date.now() - quizState.startEpoch) / 1000);
  const durationSecondsTaken = Math.min(elapsedSeconds, quizState.durationSeconds);
  
  // Map answers to the correct array expected by Apps Script
  const submitAnswers = quizState.questions.map(q => {
    return {
      questionId: q.questionId,
      selectedAnswer: quizState.answers[q.questionId] || '' // Return empty string if skipped
    };
  });
  
  // Show sending transition UI
  quizNextBtn.disabled = true;
  quizNextBtn.textContent = 'กำลังส่ง...';
  
  try {
    const postBody = {
      action: 'submitQuiz',
      studentId: studentSession.studentId,
      name: studentSession.name,
      subjectCode: quizState.subjectCode,
      mode: quizState.mode,
      durationSeconds: durationSecondsTaken,
      answers: submitAnswers
    };
    
    const res = await callAPI(apiURL, {
      method: 'POST',
      body: JSON.stringify(postBody),
      headers: {
        'Content-Type': 'text/plain' // Workaround for Apps Script CORS preflight
      }
    });
    
    if (res.success) {
      // Clear localStorage to prevent restoring finished exam
      localStorage.removeItem('webapp_exam_state');
      
      // Switch view and render score results
      showScreen('result');
      renderResults(res);
    } else {
      throw new Error(res.message || 'การส่งคะแนนขัดข้อง');
    }
  } catch (err) {
    alert(`ไม่สามารถส่งคำตอบได้เนื่องจาก: ${err.message}\nโปรดลองใหม่อีกครั้ง หรือแคปหน้าจอเพื่อขอความช่วยเหลือ`);
    // Restart timer to let user try again
    quizNextBtn.disabled = false;
    quizNextBtn.innerHTML = 'ส่งคำตอบ ➔';
    startTimer();
  }
}

// Render result values and Guided Feedback (Active Learning)
function renderResults(data) {
  resultSubjectName.textContent = `คุณทำข้อสอบวิชา: ${quizState.subjectName} (${quizState.mode === 'Exam' ? 'สอบจริง' : 'ฝึกซ้อม'})`;
  resultScoreText.textContent = `${data.score} / ${data.totalQuestions}`;
  
  // Calculate percent
  const percent = data.totalQuestions > 0 ? (data.score / data.totalQuestions) * 100 : 0;
  
  // Styling result elements
  if (data.passed) {
    resultIcon.textContent = '🎉';
    resultIcon.style.animation = 'pulse 1s infinite alternate';
    resultHeadline.textContent = 'ทำข้อสอบเสร็จสิ้น!';
    resultStatusBadge.textContent = 'ยินดีด้วย! ผ่านเกณฑ์ (60%)';
    resultStatusBadge.className = 'status-badge passed';
    resultScoreCircle.className = 'score-circle';
  } else {
    resultIcon.textContent = '🎖️';
    resultIcon.style.animation = 'none';
    resultHeadline.textContent = 'พยายามใหม่อีกครั้ง!';
    resultStatusBadge.textContent = 'ไม่ผ่านเกณฑ์การประเมิน';
    resultStatusBadge.className = 'status-badge failed';
    resultScoreCircle.className = 'score-circle failed';
  }
  
  feedbackContentArea.innerHTML = '';
  resultRetryWrongBtn.style.display = 'none';
  
  if (quizState.mode === 'Exam') {
    // --- EXAM MODE: Guided Feedback ---
    // Hide exact correct choices and questions. Show ONLY topic concepts that were incorrect.
    const title = document.createElement('h4');
    title.style.marginBottom = '12px';
    title.style.color = 'var(--color-primary)';
    title.textContent = '📝 หัวข้อประเด็นความรู้ที่ตอบผิด (เพื่อการศึกษาเพิ่มเติม):';
    feedbackContentArea.appendChild(title);
    
    if (data.incorrectTopics && data.incorrectTopics.length > 0) {
      const list = document.createElement('div');
      list.className = 'topics-list';
      
      data.incorrectTopics.forEach(topic => {
        const item = document.createElement('div');
        item.className = 'topic-item';
        item.innerHTML = `<span>📖</span> <span>หัวข้อ: ${topic}</span>`;
        list.appendChild(item);
      });
      feedbackContentArea.appendChild(list);
    } else {
      feedbackContentArea.innerHTML += `
        <div style="background-color: var(--color-success-bg); color: var(--color-success); border: 1px solid var(--color-success); padding: 12px; border-radius: var(--radius); text-align: center; font-weight: 600;">
          🟢 สุดยอด! คุณตอบถูกทุกหัวข้อวิชาในการประเมินผลรอบนี้
        </div>
      `;
    }
  } else {
    // --- PRACTICE MODE: Detailed Feedback & Active Recall ---
    // Show exact answers, explanations (Rationale), and allow retry for wrong items.
    const title = document.createElement('h4');
    title.style.marginBottom = '15px';
    title.style.color = 'var(--color-primary)';
    title.textContent = '🔍 เฉลยละเอียดวิเคราะห์จุดบกพร่อง (Practice Mode):';
    feedbackContentArea.appendChild(title);
    
    const list = document.createElement('div');
    list.className = 'review-questions-list';
    
    const wrongQuestionsToRetry = [];
    
    data.results.forEach((qResult, index) => {
      const qCard = document.createElement('div');
      const isCorrect = qResult.correct;
      qCard.className = `review-question-card ${isCorrect ? 'correct' : 'incorrect'}`;
      
      if (!isCorrect) {
        // Collect incorrect question structure for re-attempt
        const matchedQ = quizState.questions.find(origQ => origQ.questionId === qResult.questionId);
        if (matchedQ) {
          wrongQuestionsToRetry.push(matchedQ);
        }
      }
      
      // Render labels for choices
      let choicesHtml = '';
      qResult.choices.forEach((choice, cIdx) => {
        const labelChar = ['ก.', 'ข.', 'ค.', 'ง.'][cIdx] || '';
        let statusClass = '';
        
        if (qResult.selectedAnswer === choice) {
          statusClass = isCorrect ? 'correct-ans' : 'selected-wrong';
        }
        
        choicesHtml += `
          <div class="review-choice ${statusClass}">
            <strong>${labelChar}</strong> ${choice} ${qResult.selectedAnswer === choice ? (isCorrect ? ' (ถูกต้อง)' : ' (คุณเลือก - ผิด)') : ''}
          </div>
        `;
      });
      
      qCard.innerHTML = `
        <div class="review-question-header">
          <span class="review-indicator">${isCorrect ? '🟢 ถูกต้อง' : '🔴 ตอบผิด'}</span>
          <span>หัวข้อ: ${qResult.topic}</span>
        </div>
        <div class="review-question-text">ข้อที่ ${index + 1}: ${qResult.questionText}</div>
        <div class="review-choices">
          ${choicesHtml}
        </div>
        ${!isCorrect ? `
          <div class="review-explanation">
            <strong>💡 คำใบ้/หลักการทบทวน:</strong>
            ${qResult.rationale}
          </div>
        ` : ''}
      `;
      
      list.appendChild(qCard);
    });
    feedbackContentArea.appendChild(list);
    
    // If there are incorrect questions, display the Retry Incorrect button
    if (wrongQuestionsToRetry.length > 0) {
      resultRetryWrongBtn.style.display = 'inline-flex';
      
      // Remove old event listener and add new one
      const newBtn = resultRetryWrongBtn.cloneNode(true);
      resultRetryWrongBtn.parentNode.replaceChild(newBtn, resultRetryWrongBtn);
      
      newBtn.addEventListener('click', () => {
        if (confirm(`คุณต้องการสอบแก้ตัวสำหรับข้อสอบที่ทำผิดจำนวน ${wrongQuestionsToRetry.length} ข้อ หรือไม่?`)) {
          startQuiz(quizState.subjectCode, quizState.subjectName, 'Practice', wrongQuestionsToRetry.length, wrongQuestionsToRetry);
        }
      });
    }
  }
}

// Restore active session state if page is refreshed (Anti-F5)
function restoreQuizIfActive() {
  const savedState = localStorage.getItem('webapp_exam_state');
  if (savedState && studentSession) {
    try {
      const state = JSON.parse(savedState);
      const elapsedSeconds = Math.floor((Date.now() - state.startEpoch) / 1000);
      
      if (elapsedSeconds < state.durationSeconds) {
        if (confirm('พบการทำข้อสอบค้างอยู่ในระบบ คุณต้องการทำข้อสอบต่อจากเดิมหรือไม่? (เวลาจะเดินต่อเนื่องจากตอนที่ออกจากเว็บ)')) {
          quizState = state;
          showScreen('quiz');
          quizSubjectDisplay.textContent = `วิชา: ${state.subjectName}`;
          quizModeBadge.textContent = state.mode === 'Exam' ? 'สอบจริง (Exam)' : 'ฝึกซ้อม (Practice)';
          startTimer();
          renderQuestion();
        } else {
          localStorage.removeItem('webapp_exam_state');
          checkSession();
        }
      } else {
        localStorage.removeItem('webapp_exam_state');
        alert('หมดเวลาทำข้อสอบแล้วในขณะที่คุณออกจากการทำงานของบราวเซอร์ ระบบได้สลัดสิทธิ์การสอบในชุดนี้');
        checkSession();
      }
    } catch (e) {
      localStorage.removeItem('webapp_exam_state');
      checkSession();
    }
  } else {
    checkSession();
  }
}

// --- OFFLINE SIMULATION (DEMO MODE) ---

async function simulateMockAPI(url, options = {}) {
  // Extract parameters from GET url
  const urlObj = new URL(url.startsWith('http') ? url : `http://localhost/${url}`);
  const action = urlObj.searchParams.get('action');
  
  // Simulate network latency (250ms - 500ms)
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
  
  if (action === 'login') {
    const studentId = urlObj.searchParams.get('studentId');
    const password = urlObj.searchParams.get('password');
    const user = MOCK_USERS.find(u => u.id === studentId && u.password === password);
    
    if (user) {
      return { success: true, studentId: user.id, name: user.name };
    }
    return { success: false, message: 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง (ในโหมดทดลองใช้รหัส 66010123 / pass1234)' };
  }
  
  if (action === 'getSubjects') {
    return { success: true, subjects: MOCK_SUBJECTS };
  }
  
  if (action === 'getQuestions') {
    const subjectCode = urlObj.searchParams.get('subjectCode');
    const questions = MOCK_QUESTIONS[subjectCode] || [];
    
    // Strip correct answers for safety mimicking Apps Script
    const cleanQuestions = questions.map(q => {
      return {
        questionId: q.questionId,
        questionText: q.questionText,
        choices: q.choices
      };
    });
    
    return { success: true, questions: cleanQuestions };
  }
  
  if (action === 'getLeaderboard') {
    // Sort mock scores
    const sorted = [...MOCK_SCORES].sort((a, b) => {
      const aPct = a.score / a.totalQuestions;
      const bPct = b.score / b.totalQuestions;
      if (bPct !== aPct) return bPct - aPct;
      return a.durationSeconds - b.durationSeconds;
    });
    
    const formatted = sorted.map((rec, i) => {
      return {
        rank: i + 1,
        name: rec.name,
        subjectName: rec.subjectName,
        score: rec.score,
        totalQuestions: rec.totalQuestions,
        durationSeconds: rec.durationSeconds
      };
    });
    
    return { success: true, leaderboard: formatted.slice(0, 10) };
  }
  
  // POST handlers
  if (options.body) {
    const bodyObj = JSON.parse(options.body);
    const postAction = bodyObj.action;
    
    if (postAction === 'submitQuiz') {
      const studentId = bodyObj.studentId;
      const name = bodyObj.name;
      const subjectCode = bodyObj.subjectCode;
      const mode = bodyObj.mode;
      const durationSeconds = bodyObj.durationSeconds;
      const answers = bodyObj.answers;
      
      const dbQs = MOCK_QUESTIONS[subjectCode] || [];
      const qMap = {};
      dbQs.forEach(q => {
        qMap[q.questionId] = q;
      });
      
      let score = 0;
      const totalQuestions = answers.length;
      const results = [];
      const incorrectTopics = [];
      
      answers.forEach(studentAns => {
        const dbQ = qMap[studentAns.questionId];
        if (dbQ) {
          const isCorrect = studentAns.selectedAnswer === dbQ.correctAnswer;
          if (isCorrect) {
            score++;
          } else {
            if (!incorrectTopics.includes(dbQ.topic)) {
              incorrectTopics.push(dbQ.topic);
            }
          }
          
          results.push({
            questionId: studentAns.questionId,
            questionText: dbQ.questionText,
            choices: dbQ.choices,
            selectedAnswer: studentAns.selectedAnswer,
            correct: isCorrect,
            topic: dbQ.topic,
            rationale: dbQ.rationale
          });
        }
      });
      
      const passed = score >= (totalQuestions * 0.6);
      
      // Save score to leaderboard array if it's Exam mode
      if (mode === 'Exam') {
        const matchedSubject = MOCK_SUBJECTS.find(s => s.subjectCode === subjectCode);
        const subName = matchedSubject ? matchedSubject.subjectName : subjectCode;
        
        MOCK_SCORES.push({
          name: name,
          subjectName: subName,
          score: score,
          totalQuestions: totalQuestions,
          durationSeconds: durationSeconds
        });
        
        localStorage.setItem('webapp_exam_mock_scores', JSON.stringify(MOCK_SCORES));
      }
      
      if (mode === 'Exam') {
        return {
          success: true,
          score: score,
          totalQuestions: totalQuestions,
          passed: passed,
          incorrectTopics: incorrectTopics
        };
      } else {
        return {
          success: true,
          score: score,
          totalQuestions: totalQuestions,
          passed: passed,
          results: results
        };
      }
    }
  }
  
  return { success: false, message: 'การเรียกใช้งานจำลองล้มเหลว' };
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  restoreQuizIfActive();
});
