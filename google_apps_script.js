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
  var response = { success: false, message: "รองรับเฉพาะ POST API เพื่อป้องกันข้อมูลรับรองใน URL" };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var response = { success: false, message: "Invalid post action" };
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("ไม่พบข้อมูล POST");
    }
    var postData = JSON.parse(e.postData.contents);
    if (!postData || typeof postData !== "object") {
      throw new Error("รูปแบบข้อมูล POST ไม่ถูกต้อง");
    }
    var action = postData.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "login") {
      response = handleLogin(ss, postData.studentId, postData.password);
      if (response.success) {
        response.sessionToken = createSessionToken({
          studentId: response.studentId,
          name: response.name,
          role: response.role
        });
      }
    } else {
      var session = getSessionFromToken(postData.sessionToken);
      if (!session) {
        response = { success: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
      } else if (action === "getSubjects") {
        response = handleGetSubjects(ss);
      } else if (action === "getExamSets") {
        response = handleGetExamSets(ss, session);
      } else if (action === "getExamSetQuestions") {
        response = handleGetExamSetQuestions(ss, postData.examSetId);
      } else if (action === "createExamSet") {
        response = requireRole(session, ["instructor", "admin"]) || handleCreateExamSet(ss, session, postData);
      } else if (action === "publishExamSet") {
        response = requireRole(session, ["instructor", "admin"]) || handlePublishExamSet(ss, session, postData.examSetId, postData.status);
      } else if (action === "importQuestionFile") {
        response = requireRole(session, ["instructor", "admin"]) || handleImportQuestionFile(ss, session, postData);
      } else if (action === "getImportJobs") {
        response = requireRole(session, ["instructor", "admin"]) || handleGetImportJobs(ss);
      } else if (action === "approveImportJob") {
        response = requireRole(session, ["instructor", "admin"]) || handleApproveImportJob(ss, session, postData);
      } else if (action === "getQuestions") {
        response = handleGetQuestions(ss, postData.subjectCode);
      } else if (action === "getLeaderboard") {
        response = handleGetLeaderboard(ss);
      } else if (action === "submitQuiz") {
        response = handleSubmitQuiz(
          ss,
          session.studentId,
          session.name,
          postData.subjectCode,
          postData.mode,
          postData.durationSeconds,
          postData.answers
        );
      }
    }
  } catch (err) {
    response = { success: false, message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function createSessionToken(user) {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put("quiz_session:" + token, JSON.stringify(user), 21600);
  return token;
}

function getSessionFromToken(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get("quiz_session:" + String(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Run once from the Apps Script editor as the deployment owner to grant Drive access.
function authorizeDriveAccess() {
  var folders = DriveApp.getFoldersByName("WebappExam Imports");
  return folders.hasNext() ? folders.next().getName() : DriveApp.createFolder("WebappExam Imports").getName();
}

function requireRole(session, roles) {
  return roles.indexOf(String(session.role || "student").toLowerCase()) === -1
    ? { success: false, message: "ไม่มีสิทธิ์ดำเนินการนี้" }
    : null;
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function ensureHeader(sheet, name) {
  var values = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  var idx = values.indexOf(name);
  if (idx >= 0) return idx;
  idx = values.length;
  sheet.getRange(1, idx + 1).setValue(name);
  return idx;
}

function readRowsByHeaders(sheet) {
  var values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) return { headers: [], rows: [] };
  return { headers: values[0].map(function (v) { return String(v).trim(); }), rows: values.slice(1) };
}

function headerIndex(headers, name) { return headers.indexOf(name); }

// Google Sheets returns date cells as JavaScript Date objects. Serialize them
// explicitly so the browser never displays an ISO timestamp as an answer.
function serializeSheetValue(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    var tz = Session.getScriptTimeZone() || "Asia/Bangkok";
    // Keep the year stored in the sheet unchanged. This supports both
    // Gregorian and Buddhist-year data without silently shifting the date.
    return Utilities.formatDate(value, tz, "dd/MM/yyyy");
  }
  return value === null || value === undefined ? "" : String(value);
}

function handleGetExamSets(ss, session) {
  var sheet = ss.getSheetByName("ExamSets");
  if (!sheet) return { success: true, examSets: [] };
  var data = readRowsByHeaders(sheet), id = headerIndex(data.headers, "ExamSetID");
  var name = headerIndex(data.headers, "Name"), status = headerIndex(data.headers, "Status");
  if (id < 0 || name < 0 || status < 0) return { success: false, message: "โครงสร้างตาราง ExamSets ไม่ถูกต้อง" };
  var canManage = session && ["admin", "instructor"].indexOf(String(session.role).toLowerCase()) >= 0;
  var sets = data.rows.filter(function (r) { return canManage || String(r[status]).toLowerCase() === "published"; }).map(function (r) {
    return { examSetId: String(r[id]), name: String(r[name]), description: String(r[headerIndex(data.headers, "Description")] || ""), status: String(r[status]), questionLimit: Number(r[headerIndex(data.headers, "QuestionLimit")]) || 0 };
  });
  return { success: true, examSets: sets };
}

function handleGetExamSetQuestions(ss, examSetId) {
  if (!examSetId || String(examSetId).length > 100) return { success: false, message: "รหัสชุดข้อสอบไม่ถูกต้อง" };
  var items = ss.getSheetByName("ExamSetItems"), questions = ss.getSheetByName("Questions");
  if (!items || !questions) return { success: false, message: "ยังไม่ได้ตั้งค่าชีตชุดข้อสอบ" };
  var iData = readRowsByHeaders(items), qData = readRowsByHeaders(questions);
  var setIdx = headerIndex(iData.headers, "ExamSetID"), qidIdx = headerIndex(iData.headers, "QuestionID");
  if (setIdx < 0 || qidIdx < 0) return { success: false, message: "โครงสร้างตาราง ExamSetItems ไม่ถูกต้อง" };
  var qid = headerIndex(qData.headers, "QuestionID"), text = headerIndex(qData.headers, "QuestionText");
  var choices = ["ChoiceA", "ChoiceB", "ChoiceC", "ChoiceD"].map(function (h) { return headerIndex(qData.headers, h); });
  if (qid < 0 || text < 0 || choices.some(function (x) { return x < 0; })) return { success: false, message: "โครงสร้างตาราง Questions ไม่ถูกต้อง" };
  var allowed = {};
  iData.rows.filter(function (r) { return String(r[setIdx]) === String(examSetId); }).forEach(function (r) { allowed[String(r[qidIdx])] = true; });
  var result = qData.rows.filter(function (r) { return allowed[String(r[qid])]; }).map(function (r) { return { questionId: serializeSheetValue(r[qid]), questionText: serializeSheetValue(r[text]), choices: choices.map(function (x) { return serializeSheetValue(r[x]); }) }; });
  return { success: true, questions: result };
}

function handleCreateExamSet(ss, session, data) {
  var name = String(data.name || "").trim(), ids = Array.isArray(data.questionIds) ? data.questionIds : [];
  if (!name || name.length > 120 || ids.length < 1 || ids.length > 500) return { success: false, message: "ข้อมูลชุดข้อสอบไม่ถูกต้อง" };
  ids = ids.map(String).map(function (x) { return x.trim(); }).filter(Boolean);
  if (new Set(ids).size !== ids.length) return { success: false, message: "มีรหัสข้อสอบซ้ำ" };
  var id = "SET-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  var sets = getOrCreateSheet(ss, "ExamSets", ["ExamSetID", "Name", "Description", "Status", "QuestionLimit", "CreatedBy", "CreatedAt"]);
  var items = getOrCreateSheet(ss, "ExamSetItems", ["ExamSetID", "QuestionID"]);
  sets.appendRow([id, name, String(data.description || "").slice(0, 500), "draft", ids.length, session.studentId, new Date()]);
  items.getRange(items.getLastRow() + 1, 1, ids.length, 2).setValues(ids.map(function (q) { return [id, q]; }));
  return { success: true, examSetId: id };
}

function handlePublishExamSet(ss, session, examSetId, status) {
  if (!examSetId || ["draft", "published", "archived"].indexOf(String(status)) < 0) return { success: false, message: "ข้อมูลสถานะไม่ถูกต้อง" };
  var sheet = ss.getSheetByName("ExamSets");
  if (!sheet) return { success: false, message: "ไม่พบชีต ExamSets" };
  var data = readRowsByHeaders(sheet), id = headerIndex(data.headers, "ExamSetID"), st = headerIndex(data.headers, "Status");
  for (var i = 0; i < data.rows.length; i++) if (String(data.rows[i][id]) === String(examSetId)) { sheet.getRange(i + 2, st + 1).setValue(String(status)); return { success: true }; }
  return { success: false, message: "ไม่พบชุดข้อสอบ" };
}

function handleImportQuestionFile(ss, session, data) {
  var name = String(data.fileName || "").trim(), content = String(data.contentBase64 || "");
  var ext = name.toLowerCase().split(".").pop();
  if (!name || ["pdf", "doc", "docx", "txt"].indexOf(ext) < 0 || content.length > 8 * 1024 * 1024) return { success: false, message: "ชนิดหรือขนาดไฟล์ไม่รองรับ" };
  var bytes;
  try { bytes = Utilities.base64Decode(content); } catch (err) { return { success: false, message: "ไฟล์ไม่ใช่ Base64 ที่ถูกต้อง" }; }
  var blob = Utilities.newBlob(bytes, data.mimeType || MimeType.PLAIN_TEXT, name);
  var folder;
  try {
    var folders = DriveApp.getFoldersByName("WebappExam Imports");
    folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("WebappExam Imports");
  } catch (driveErr) {
    return { success: false, message: "ยังไม่ได้อนุญาต Google Drive ให้ Apps Script กรุณาเปิดโปรเจกต์ Apps Script แล้วกด Review permissions/Allow จากนั้น deploy ใหม่" };
  }
  var file = folder.createFile(blob);
  var jobs = getOrCreateSheet(ss, "ImportJobs", ["JobID", "FileID", "FileName", "Type", "Status", "UploadedBy", "CreatedAt"]);
  var job = "IMP-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  var status = ext === "docx" || ext === "txt" ? "ready_for_review" : "manual_review_required";
  var preview = ext === "docx" ? extractDocxPreview(blob) : "";
  jobs.appendRow([job, file.getId(), name, ext, status, session.studentId, new Date()]);
  jobs.getRange(1, ensureHeader(jobs, "Preview") + 1).setValue("Preview");
  jobs.getRange(jobs.getLastRow(), ensureHeader(jobs, "Preview") + 1).setValue(preview.slice(0, 45000));
  return { success: true, jobId: job, status: status, preview: preview.slice(0, 4000), message: "อัปโหลดไฟล์แล้ว กรุณาตรวจทานคำตอบก่อนเผยแพร่ข้อสอบ" };
}

function handleGetImportJobs(ss) {
  var sheet = ss.getSheetByName("ImportJobs");
  if (!sheet) return { success: true, jobs: [] };
  var data = readRowsByHeaders(sheet), id = headerIndex(data.headers, "JobID"), file = headerIndex(data.headers, "FileName"), type = headerIndex(data.headers, "Type"), status = headerIndex(data.headers, "Status"), preview = headerIndex(data.headers, "Preview");
  if (id < 0 || file < 0 || status < 0) return { success: false, message: "โครงสร้างตาราง ImportJobs ไม่ถูกต้อง" };
  return { success: true, jobs: data.rows.slice(-20).reverse().map(function (r) { return { jobId: String(r[id]), fileName: String(r[file]), type: type >= 0 ? String(r[type]) : "", status: String(r[status]), preview: preview >= 0 ? String(r[preview] || "").slice(0, 4000) : "" }; }) };
}

function parseQuestionPreview(preview) {
  var lines = String(preview || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), result = [], current = null;
  lines.forEach(function (line) {
    var option = line.match(/^[A-D][.)]\s*(.*)$/i);
    if (/^(Q|Question|ข้อ)\s*[:.)-]/i.test(line) || (!option && !current)) { if (current) result.push(current); current = { text: line.replace(/^(Q|Question|ข้อ)\s*[:.)-]\s*/i, ""), choices: [], answer: "" }; return; }
    if (!current) return;
    if (option) { var value = option[1].replace(/^\[ANSWER:(.*)\]$/i, "$1"); current.choices.push(value); if (/\[ANSWER:/i.test(option[1])) current.answer = value; return; }
    if (/\[ANSWER:/i.test(line)) current.answer = line.replace(/^.*\[ANSWER:\s*(.*?)\].*$/i, "$1");
  });
  if (current) result.push(current);
  return result.filter(function (q) { return q.text && q.choices.length >= 2 && q.answer; });
}

function handleApproveImportJob(ss, session, data) {
  var jobId = String(data.jobId || "").trim(), subjectCode = String(data.subjectCode || "").trim();
  if (!jobId || !subjectCode || subjectCode.length > 100) return { success: false, message: "กรุณาระบุเลขงานและรหัสวิชา" };
  var jobs = ss.getSheetByName("ImportJobs");
  if (!jobs) return { success: false, message: "ไม่พบชีต ImportJobs" };
  var jobData = readRowsByHeaders(jobs), id = headerIndex(jobData.headers, "JobID"), status = headerIndex(jobData.headers, "Status"), preview = headerIndex(jobData.headers, "Preview"), fileIdIdx = headerIndex(jobData.headers, "FileID"), typeIdx = headerIndex(jobData.headers, "Type");
  var row = null;
  for (var i = 0; i < jobData.rows.length; i++) if (String(jobData.rows[i][id]) === jobId) { row = jobData.rows[i]; break; }
  if (!row) return { success: false, message: "ไม่พบเลขงานนำเข้า" };
  if (String(row[status]) === "approved") return { success: false, message: "งานนี้ถูกอนุมัติแล้ว" };
  var previewText = preview >= 0 ? String(row[preview] || "") : "";
  if (!previewText && fileIdIdx >= 0 && typeIdx >= 0 && String(row[typeIdx]).toLowerCase() === "docx") {
    try { previewText = extractDocxPreview(DriveApp.getFileById(String(row[fileIdIdx])).getBlob()); } catch (err) { return { success: false, message: "อ่านไฟล์ DOCX ไม่สำเร็จ กรุณาอัปโหลดใหม่หลังอนุญาต Drive" }; }
  }
  var parsed = parseQuestionPreview(previewText);
  if (!parsed.length) return { success: false, message: "ไม่พบรูปแบบข้อสอบที่ระบบอ่านได้ กรุณาตรวจทานและเพิ่มลงชีต Questions ด้วยตนเอง" };
  var qSheet = getOrCreateSheet(ss, "Questions", ["SubjectCode", "QuestionID", "QuestionText", "ChoiceA", "ChoiceB", "ChoiceC", "ChoiceD", "CorrectAnswer", "Topic", "Rationale"]);
  var qData = readRowsByHeaders(qSheet), qid = headerIndex(qData.headers, "QuestionID"), existing = {};
  qData.rows.forEach(function (r) { if (qid >= 0) existing[String(r[qid])] = true; });
  var rows = parsed.map(function (q, n) { var newId = jobId + "-Q" + (n + 1); return [subjectCode, newId, q.text, q.choices[0] || "", q.choices[1] || "", q.choices[2] || "", q.choices[3] || "", q.answer, "นำเข้าจากไฟล์", "ตรวจทานจากไฟล์ " + jobId]; }).filter(function (r) { return !existing[String(r[1])]; });
  if (!rows.length) return { success: false, message: "ไม่มีข้อสอบใหม่ให้เพิ่ม" };
  qSheet.getRange(qSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  jobs.getRange(jobData.rows.indexOf(row) + 2, status + 1).setValue("approved");
  return { success: true, imported: rows.length, jobId: jobId };
}

function extractDocxPreview(blob) {
  try {
    var files = Utilities.unzip(blob), xmlBlob = null;
    for (var i = 0; i < files.length; i++) if (files[i].getName() === "word/document.xml") xmlBlob = files[i];
    if (!xmlBlob) return "";
    var xml = xmlBlob.getDataAsString("UTF-8");
    var doc = XmlService.parse(xml), ns = XmlService.getNamespace("http://schemas.openxmlformats.org/wordprocessingml/2006/main");
    var paragraphs = doc.getRootElement().getChild("body", ns).getChildren("p", ns), out = [];
    paragraphs.forEach(function (p) {
      var runs = p.getChildren("r", ns), line = "";
      runs.forEach(function (r) {
        var t = r.getChild("t", ns), text = t ? t.getText() : "";
        var props = r.getChild("rPr", ns), bold = props && props.getChild("b", ns);
        line += bold ? "[ANSWER:" + text + "]" : text;
      });
      if (line.trim()) out.push(line.trim());
    });
    return out.join("\n");
  } catch (err) { return ""; }
}

// 1. LOGIN HANDLER
function handleLogin(ss, studentId, password) {
  if (!studentId || !password) {
    return { success: false, message: "กรุณากรอกรหัสนักเรียนและรหัสผ่าน" };
  }
  
  var sheet = ss.getSheetByName("Users");
  if (!sheet) return { success: false, message: "ไม่พบชีต Users" };
  
  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0 || !data[0]) {
    return { success: false, message: "ชีต Users ยังไม่มี header" };
  }
  // Columns: StudentID, Password, Name
  var headers = data[0];
  var idIdx = headers.indexOf("StudentID");
  var pwIdx = headers.indexOf("Password");
  var nameIdx = headers.indexOf("Name");
  var roleIdx = headers.indexOf("Role");
  
  if (idIdx === -1 || pwIdx === -1 || nameIdx === -1) {
    return { success: false, message: "โครงสร้างตาราง Users ไม่ถูกต้อง" };
  }
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[idIdx]).trim() === String(studentId).trim()) {
      if (String(row[pwIdx]).trim() === String(password).trim()) {
        var role = roleIdx === -1 || !row[roleIdx] ? "student" : String(row[roleIdx]).trim().toLowerCase();
        if (["student", "instructor", "admin"].indexOf(role) === -1) role = "student";
        return { 
          success: true, 
          studentId: String(row[idIdx]).trim(),
          name: row[nameIdx],
          role: role
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
  if (!data || data.length === 0 || !data[0]) {
    return { success: false, message: "ชีต Subjects ยังไม่มี header" };
  }
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
  if (!data || data.length === 0 || !data[0]) {
    return { success: false, message: "ชีต Questions ยังไม่มี header" };
  }
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
        questionId: serializeSheetValue(row[idIdx]),
        questionText: serializeSheetValue(row[textIdx]),
        choices: [
          serializeSheetValue(row[choiceAIdx]),
          serializeSheetValue(row[choiceBIdx]),
          serializeSheetValue(row[choiceCIdx]),
          serializeSheetValue(row[choiceDIdx])
        ]
      });
    }
  }
  
  return { success: true, questions: questions };
}

// 4. SUBMIT & GRADE QUIZ HANDLER
function handleSubmitQuiz(ss, studentId, name, subjectCode, mode, durationSeconds, answers) {
  if (!studentId || !subjectCode || !mode || !Array.isArray(answers) || answers.length === 0 || answers.length > 100) {
    return { success: false, message: "ข้อมูลการส่งข้อสอบไม่ครบถ้วน" };
  }
  if (mode !== "Exam" && mode !== "Practice") {
    return { success: false, message: "รูปแบบการสอบไม่ถูกต้อง" };
  }
  var seenQuestionIds = {};
  for (var a = 0; a < answers.length; a++) {
    if (!answers[a] || !answers[a].questionId || seenQuestionIds[String(answers[a].questionId)]) {
      return { success: false, message: "รายการคำถามซ้ำหรือไม่ถูกต้อง" };
    }
    seenQuestionIds[String(answers[a].questionId)] = true;
  }
  
  var qSheet = ss.getSheetByName("Questions");
  if (!qSheet) return { success: false, message: "ไม่พบชีต Questions" };
  
  var qData = qSheet.getDataRange().getValues();
  if (!qData || qData.length === 0 || !qData[0]) {
    return { success: false, message: "ชีต Questions ยังไม่มี header" };
  }
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
  if (qIdIdx === -1 || qTextIdx === -1 || qChoiceAIdx === -1 || qChoiceBIdx === -1 || qChoiceCIdx === -1 || qChoiceDIdx === -1 || qAnsIdx === -1) {
    return { success: false, message: "โครงสร้างตาราง Questions ไม่ถูกต้อง" };
  }
  
  // Build a Map of questions in DB for fast lookup
  var qMap = {};
  for (var i = 1; i < qData.length; i++) {
    var row = qData[i];
    var qId = String(row[qIdIdx]).trim();
    qMap[qId] = {
      text: serializeSheetValue(row[qTextIdx]),
      choices: [serializeSheetValue(row[qChoiceAIdx]), serializeSheetValue(row[qChoiceBIdx]), serializeSheetValue(row[qChoiceCIdx]), serializeSheetValue(row[qChoiceDIdx])],
      correctAnswer: serializeSheetValue(row[qAnsIdx]).trim(),
      topic: qTopicIdx !== -1 ? row[qTopicIdx] : "ทั่วไป",
      rationale: qRationaleIdx !== -1 ? row[qRationaleIdx] : "ไม่มีคำอธิบายเพิ่มเติม"
    };
  }
  
  var score = 0;
  var totalQuestions = answers.length;
  var results = [];
  var incorrectTopics = [];

  for (var v = 0; v < answers.length; v++) {
    if (!qMap[String(answers[v].questionId).trim()]) {
      return { success: false, message: "พบรหัสข้อสอบที่ไม่มีอยู่ในคลัง" };
    }
  }
  
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
