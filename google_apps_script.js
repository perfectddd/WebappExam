/**
 * Google Apps Script for WebappExam API Backend
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click Extensions -> Apps Script.
 * 3. Delete any code in the editor and paste this code.
 * 4. Create 4 sheets (tabs) in your Google Sheet with the exact names:
 *    "Users", "Subjects", "Questions", "Scores".
 * 5. Add headers to each sheet exactly as described in the DB Schema.
 * 6. Click Deploy -> New deployment.
 * 7. Choose type: "Web app".
 * 8. Set Execute as: "Me" and Who has access: "Anyone".
 * 9. Click Deploy, authorize permissions, and copy the Web App URL.
 */

// Handle CORS and preflight requests
function doGet(e) {
  var action = e.parameter.action;
  var response = { success: false, message: "Invalid action" };
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "login") {
      response = handleLogin(ss, e.parameter.studentId, e.parameter.password);
    } else if (action === "getSubjects") {
      response = handleGetSubjects(ss);
    } else if (action === "getQuestions") {
      response = handleGetQuestions(ss, e.parameter.subjectCode);
    } else if (action === "getLeaderboard") {
      response = handleGetLeaderboard(ss);
    }
  } catch (err) {
    response = { success: false, message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var response = { success: false, message: "Invalid post action" };
  
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "submitQuiz") {
      response = handleSubmitQuiz(
        ss,
        postData.studentId,
        postData.name,
        postData.subjectCode,
        postData.mode,
        postData.durationSeconds,
        postData.answers
      );
    }
  } catch (err) {
    response = { success: false, message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// 1. LOGIN HANDLER
function handleLogin(ss, studentId, password) {
  if (!studentId || !password) {
    return { success: false, message: "กรุณากรอกรหัสนักเรียนและรหัสผ่าน" };
  }
  
  var sheet = ss.getSheetByName("Users");
  if (!sheet) return { success: false, message: "ไม่พบชีต Users" };
  
  var data = sheet.getDataRange().getValues();
  // Columns: StudentID, Password, Name
  var headers = data[0];
  var idIdx = headers.indexOf("StudentID");
  var pwIdx = headers.indexOf("Password");
  var nameIdx = headers.indexOf("Name");
  
  if (idIdx === -1 || pwIdx === -1 || nameIdx === -1) {
    return { success: false, message: "โครงสร้างตาราง Users ไม่ถูกต้อง" };
  }
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[idIdx]).trim() === String(studentId).trim()) {
      if (String(row[pwIdx]).trim() === String(password).trim()) {
        return { 
          success: true, 
          studentId: String(row[idIdx]).trim(),
          name: row[nameIdx] 
        };
      } else {
        return { success: false, message: "รหัสผ่านไม่ถูกต้อง" };
      }
    }
  }
  
  return { success: false, message: "ไม่พบรหัสนักเรียนนี้ในระบบ" };
}

// 2. GET SUBJECTS HANDLER
function handleGetSubjects(ss) {
  var sheet = ss.getSheetByName("Subjects");
  if (!sheet) return { success: false, message: "ไม่พบชีต Subjects" };
  
  var data = sheet.getDataRange().getValues();
  // Columns: SubjectCode, SubjectName, Status
  var headers = data[0];
  var codeIdx = headers.indexOf("SubjectCode");
  var nameIdx = headers.indexOf("SubjectName");
  var statusIdx = headers.indexOf("Status");
  
  if (codeIdx === -1 || nameIdx === -1 || statusIdx === -1) {
    return { success: false, message: "โครงสร้างตาราง Subjects ไม่ถูกต้อง" };
  }
  
  var subjects = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[statusIdx]).trim().toLowerCase() === "open") {
      subjects.push({
        subjectCode: row[codeIdx],
        subjectName: row[nameIdx]
      });
    }
  }
  
  return { success: true, subjects: subjects };
}

// 3. GET QUESTIONS HANDLER (Security: Excludes CorrectAnswer, Topic, Rationale)
function handleGetQuestions(ss, subjectCode) {
  if (!subjectCode) {
    return { success: false, message: "กรุณาระบุรหัสวิชา" };
  }
  
  var sheet = ss.getSheetByName("Questions");
  if (!sheet) return { success: false, message: "ไม่พบชีต Questions" };
  
  var data = sheet.getDataRange().getValues();
  // Columns: SubjectCode, QuestionID, QuestionText, ChoiceA, ChoiceB, ChoiceC, ChoiceD
  var headers = data[0];
  var subCodeIdx = headers.indexOf("SubjectCode");
  var idIdx = headers.indexOf("QuestionID");
  var textIdx = headers.indexOf("QuestionText");
  var choiceAIdx = headers.indexOf("ChoiceA");
  var choiceBIdx = headers.indexOf("ChoiceB");
  var choiceCIdx = headers.indexOf("ChoiceC");
  var choiceDIdx = headers.indexOf("ChoiceD");
  
  if (subCodeIdx === -1 || idIdx === -1 || textIdx === -1 || choiceAIdx === -1 || choiceBIdx === -1 || choiceCIdx === -1 || choiceDIdx === -1) {
    return { success: false, message: "โครงสร้างตาราง Questions ไม่ถูกต้อง" };
  }
  
  var questions = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[subCodeIdx]).trim() === String(subjectCode).trim()) {
      questions.push({
        questionId: row[idIdx],
        questionText: row[textIdx],
        choices: [
          row[choiceAIdx],
          row[choiceBIdx],
          row[choiceCIdx],
          row[choiceDIdx]
        ]
      });
    }
  }
  
  return { success: true, questions: questions };
}

// 4. SUBMIT & GRADE QUIZ HANDLER
function handleSubmitQuiz(ss, studentId, name, subjectCode, mode, durationSeconds, answers) {
  if (!studentId || !subjectCode || !mode || !answers) {
    return { success: false, message: "ข้อมูลการส่งข้อสอบไม่ครบถ้วน" };
  }
  
  var qSheet = ss.getSheetByName("Questions");
  if (!qSheet) return { success: false, message: "ไม่พบชีต Questions" };
  
  var qData = qSheet.getDataRange().getValues();
  var qHeaders = qData[0];
  var qIdIdx = qHeaders.indexOf("QuestionID");
  var qTextIdx = qHeaders.indexOf("QuestionText");
  var qChoiceAIdx = qHeaders.indexOf("ChoiceA");
  var qChoiceBIdx = qHeaders.indexOf("ChoiceB");
  var qChoiceCIdx = qHeaders.indexOf("ChoiceC");
  var qChoiceDIdx = qHeaders.indexOf("ChoiceD");
  var qAnsIdx = qHeaders.indexOf("CorrectAnswer");
  var qTopicIdx = qHeaders.indexOf("Topic");
  var qRationaleIdx = qHeaders.indexOf("Rationale");
  
  // Build a Map of questions in DB for fast lookup
  var qMap = {};
  for (var i = 1; i < qData.length; i++) {
    var row = qData[i];
    var qId = String(row[qIdIdx]).trim();
    qMap[qId] = {
      text: row[qTextIdx],
      choices: [row[qChoiceAIdx], row[qChoiceBIdx], row[qChoiceCIdx], row[qChoiceDIdx]],
      correctAnswer: String(row[qAnsIdx]).trim(),
      topic: qTopicIdx !== -1 ? row[qTopicIdx] : "ทั่วไป",
      rationale: qRationaleIdx !== -1 ? row[qRationaleIdx] : "ไม่มีคำอธิบายเพิ่มเติม"
    };
  }
  
  var score = 0;
  var totalQuestions = answers.length;
  var results = [];
  var incorrectTopics = [];
  
  for (var j = 0; j < answers.length; j++) {
    var studentAns = answers[j];
    var dbQ = qMap[studentAns.questionId];
    
    if (dbQ) {
      var isCorrect = String(studentAns.selectedAnswer).trim() === dbQ.correctAnswer;
      if (isCorrect) {
        score++;
      } else {
        if (incorrectTopics.indexOf(dbQ.topic) === -1) {
          incorrectTopics.push(dbQ.topic);
        }
      }
      
      results.push({
        questionId: studentAns.questionId,
        questionText: dbQ.text,
        choices: dbQ.choices,
        selectedAnswer: studentAns.selectedAnswer,
        correct: isCorrect,
        topic: dbQ.topic,
        rationale: dbQ.rationale
      });
    }
  }
  
  // 5. SAVE SCORE TO SHEET
  var scoreSheet = ss.getSheetByName("Scores");
  if (scoreSheet) {
    var timestamp = new Date();
    // Headers: Timestamp, StudentID, Name, SubjectCode, Score, TotalQuestions, Mode, DurationSeconds
    scoreSheet.appendRow([
      timestamp,
      studentId,
      name || "ไม่ระบุชื่อ",
      subjectCode,
      score,
      totalQuestions,
      mode,
      durationSeconds || 0
    ]);
  }
  
  var passed = score >= (totalQuestions * 0.6); // 60% Passing grade
  
  // Guided Feedback Response based on Mode
  if (mode === "Exam") {
    // Exam mode: Return ONLY score and the topics of wrong questions (No exact answers or explanations)
    return {
      success: true,
      score: score,
      totalQuestions: totalQuestions,
      passed: passed,
      incorrectTopics: incorrectTopics
    };
  } else {
    // Practice mode: Return detailed results including explanations/rationales for active learning
    return {
      success: true,
      score: score,
      totalQuestions: totalQuestions,
      passed: passed,
      results: results
    };
  }
}

// 6. GET LEADERBOARD HANDLER
function handleGetLeaderboard(ss) {
  var sheet = ss.getSheetByName("Scores");
  if (!sheet) return { success: false, message: "ไม่พบชีต Scores" };
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, leaderboard: [] };
  }
  
  var headers = data[0];
  var timeIdx = headers.indexOf("Timestamp");
  var idIdx = headers.indexOf("StudentID");
  var nameIdx = headers.indexOf("Name");
  var codeIdx = headers.indexOf("SubjectCode");
  var scoreIdx = headers.indexOf("Score");
  var totalIdx = headers.indexOf("TotalQuestions");
  var modeIdx = headers.indexOf("Mode");
  var durationIdx = headers.indexOf("DurationSeconds");
  
  var subSheet = ss.getSheetByName("Subjects");
  var subMap = {};
  if (subSheet) {
    var subData = subSheet.getDataRange().getValues();
    for (var k = 1; k < subData.length; k++) {
      subMap[subData[k][0]] = subData[k][1];
    }
  }
  
  var records = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Filter only Exam mode
    var mode = modeIdx !== -1 ? String(row[modeIdx]).trim() : "Exam";
    if (mode.toLowerCase() === "practice") continue;
    
    var rawScore = Number(row[scoreIdx]);
    var rawTotal = Number(row[totalIdx]);
    var percent = rawTotal > 0 ? (rawScore / rawTotal) : 0;
    
    records.push({
      studentId: row[idIdx],
      name: row[nameIdx],
      subjectCode: row[codeIdx],
      subjectName: subMap[row[codeIdx]] || row[codeIdx],
      score: rawScore,
      totalQuestions: rawTotal,
      percentage: percent,
      timestamp: row[timeIdx],
      durationSeconds: durationIdx !== -1 ? Number(row[durationIdx]) : 99999
    });
  }
  
  // Sort algorithm:
  // 1. Highest Percentage score first
  // 2. If equal, lowest DurationSeconds first
  // 3. If equal, oldest Timestamp first (first-come first-served)
  records.sort(function(a, b) {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    if (a.durationSeconds !== b.durationSeconds) {
      return a.durationSeconds - b.durationSeconds;
    }
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  
  // Take Top 10 records
  var leaderboard = [];
  var limit = Math.min(records.length, 10);
  for (var j = 0; j < limit; j++) {
    var rec = records[j];
    leaderboard.push({
      rank: j + 1,
      name: rec.name,
      subjectName: rec.subjectName,
      score: rec.score,
      totalQuestions: rec.totalQuestions,
      durationSeconds: rec.durationSeconds
    });
  }
  
  return { success: true, leaderboard: leaderboard };
}
