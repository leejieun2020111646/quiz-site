import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { initialStudents } from "./students.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const QUIZ_STORAGE_KEY = "faib-quiz-data-v2";
const STUDENT_STORAGE_KEY = "faib-student-data-v2";

function parseWrongQuestions(text, totalQuestions) {
  if (!text.trim()) return [];
  return [...new Set(
    text
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= totalQuestions)
  )].sort((a, b) => a - b);
}

function scoreFromWrongQuestions(totalQuestions, wrongQuestions) {
  return Math.max(0, totalQuestions - wrongQuestions.length);
}

function getQuizStats(quiz, students) {
  const records = quiz.records || {};
  const scoredStudents = Object.keys(records);
  const totalScored = scoredStudents.length;

  const scores = scoredStudents.map((studentId) =>
    scoreFromWrongQuestions(quiz.totalQuestions, records[studentId].wrongQuestions || [])
  );

  const average =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

  const wrongCounts = Array.from({ length: quiz.totalQuestions }, (_, i) => {
    const q = i + 1;
    let count = 0;
    for (const studentId of scoredStudents) {
      const wrongQuestions = records[studentId].wrongQuestions || [];
      if (wrongQuestions.includes(q)) count += 1;
    }
    return count;
  });

  const wrongRates = wrongCounts.map((count) =>
    totalScored > 0 ? (count / totalScored) * 100 : 0
  );

  const distribution = {};
  for (let score = 0; score <= quiz.totalQuestions; score += 1) {
    distribution[score] = 0;
  }
  scores.forEach((score) => {
    distribution[score] += 1;
  });

  return {
    totalScored,
    average,
    wrongRates,
    distribution,
    scores,
  };
}

function buildStudentResults(studentId, quizzes) {
  return quizzes
    .map((quiz) => {
      const record = quiz.records?.[studentId];
      if (!record) return null;
      const wrongQuestions = record.wrongQuestions || [];
      return {
        quizId: quiz.id,
        title: quiz.title,
        date: quiz.date,
        totalQuestions: quiz.totalQuestions,
        wrongQuestions,
        score: scoreFromWrongQuestions(quiz.totalQuestions, wrongQuestions),
      };
    })
    .filter(Boolean);
}

export default function App() {
  const [students, setStudents] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  const [quizTitle, setQuizTitle] = useState("");
  const [quizDate, setQuizDate] = useState("");
  const [quizTotalQuestions, setQuizTotalQuestions] = useState(10);

  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [wrongQuestionsText, setWrongQuestionsText] = useState("");

  const [search, setSearch] = useState("");
  const [lookupStudentId, setLookupStudentId] = useState("");

  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentDepartment, setNewStudentDepartment] = useState("");
  const [newStudentSection, setNewStudentSection] = useState("CS.40711");

  const [activeTab, setActiveTab] = useState("input");

  useEffect(() => {
    try {
      const savedStudents = localStorage.getItem(STUDENT_STORAGE_KEY);
      if (savedStudents) {
        const parsed = JSON.parse(savedStudents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStudents(parsed);
          setSelectedStudentId(parsed[0].studentId);
          setLookupStudentId(parsed[0].studentId);
        } else {
          setStudents(initialStudents);
          setSelectedStudentId(initialStudents[0].studentId);
          setLookupStudentId(initialStudents[0].studentId);
        }
      } else {
        setStudents(initialStudents);
        setSelectedStudentId(initialStudents[0].studentId);
        setLookupStudentId(initialStudents[0].studentId);
      }

      const savedQuizzes = localStorage.getItem(QUIZ_STORAGE_KEY);
      if (savedQuizzes) {
        const parsed = JSON.parse(savedQuizzes);
        if (Array.isArray(parsed)) {
          setQuizzes(parsed);
          if (parsed[0]) setSelectedQuizId(parsed[0].id);
        }
      } else {
        const sample = [
          {
            id: "quiz-1",
            title: "Week 1 Quiz",
            date: "2026-03-11",
            totalQuestions: 10,
            records: {},
          },
        ];
        setQuizzes(sample);
        setSelectedQuizId("quiz-1");
      }
    } catch (e) {
      console.error(e);
      setStudents(initialStudents);
      setSelectedStudentId(initialStudents[0].studentId);
      setLookupStudentId(initialStudents[0].studentId);
    }
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(students));
    }
  }, [students]);

  useEffect(() => {
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
  }, [quizzes]);

  const selectedQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId) || quizzes[0] || null,
    [quizzes, selectedQuizId]
  );

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(keyword) ||
        student.studentId.includes(keyword)
    );
  }, [students, search]);

  const lookupStudent =
    students.find((student) => student.studentId === lookupStudentId) || null;

  const lookupResults = useMemo(
    () => buildStudentResults(lookupStudentId, quizzes),
    [lookupStudentId, quizzes]
  );

  const analytics = useMemo(() => {
    if (!selectedQuiz) return null;
    return getQuizStats(selectedQuiz, students);
  }, [selectedQuiz, students]);

  function addQuiz() {
    if (!quizTitle.trim() || !quizDate || !quizTotalQuestions) return;

    const newQuiz = {
      id: `quiz-${Date.now()}`,
      title: quizTitle.trim(),
      date: quizDate,
      totalQuestions: Number(quizTotalQuestions),
      records: {},
    };

    const next = [newQuiz, ...quizzes];
    setQuizzes(next);
    setSelectedQuizId(newQuiz.id);
    setQuizTitle("");
    setQuizDate("");
    setQuizTotalQuestions(10);
  }

  function saveWrongQuestions() {
    if (!selectedQuiz || !selectedStudentId) return;

    const wrongQuestions = parseWrongQuestions(
      wrongQuestionsText,
      selectedQuiz.totalQuestions
    );

    const next = quizzes.map((quiz) => {
      if (quiz.id !== selectedQuiz.id) return quiz;
      return {
        ...quiz,
        records: {
          ...quiz.records,
          [selectedStudentId]: {
            wrongQuestions,
          },
        },
      };
    });

    setQuizzes(next);
    setWrongQuestionsText("");
  }

  function deleteQuiz(quizId) {
    const next = quizzes.filter((quiz) => quiz.id !== quizId);
    setQuizzes(next);
    setSelectedQuizId(next[0]?.id || "");
  }

  function loadExistingRecord(studentId) {
    if (!selectedQuiz) return;
    const existing = selectedQuiz.records?.[studentId];
    setWrongQuestionsText((existing?.wrongQuestions || []).join(", "));
  }

  function addStudent() {
    if (!newStudentName.trim() || !newStudentId.trim() || !newStudentDepartment.trim()) {
      return;
    }

    if (students.some((student) => student.studentId === newStudentId.trim())) {
      alert("Student ID already exists.");
      return;
    }

    const newStudent = {
      section: newStudentSection,
      department: newStudentDepartment.trim(),
      studentId: newStudentId.trim(),
      name: newStudentName.trim(),
    };

    const next = [...students, newStudent].sort((a, b) =>
      a.studentId.localeCompare(b.studentId)
    );
    setStudents(next);
    setSelectedStudentId(newStudent.studentId);
    setLookupStudentId(newStudent.studentId);

    setNewStudentName("");
    setNewStudentId("");
    setNewStudentDepartment("");
    setNewStudentSection("CS.40711");
  }

  function deleteStudent(studentId) {
    const confirmed = window.confirm("Delete this student?");
    if (!confirmed) return;

    const nextStudents = students.filter((student) => student.studentId !== studentId);
    setStudents(nextStudents);

    const nextQuizzes = quizzes.map((quiz) => {
      const nextRecords = { ...(quiz.records || {}) };
      delete nextRecords[studentId];
      return { ...quiz, records: nextRecords };
    });
    setQuizzes(nextQuizzes);

    if (selectedStudentId === studentId) {
      setSelectedStudentId(nextStudents[0]?.studentId || "");
    }
    if (lookupStudentId === studentId) {
      setLookupStudentId(nextStudents[0]?.studentId || "");
    }
  }

  const wrongRateChartData = selectedQuiz && analytics
    ? {
        labels: Array.from({ length: selectedQuiz.totalQuestions }, (_, i) => `Q${i + 1}`),
        datasets: [
          {
            label: "Wrong Answer Rate (%)",
            data: analytics.wrongRates,
            backgroundColor: "rgba(59, 130, 246, 0.7)",
          },
        ],
      }
    : null;

  const scoreDistributionData = selectedQuiz && analytics
    ? {
        labels: Array.from({ length: selectedQuiz.totalQuestions + 1 }, (_, i) => `${i}`),
        datasets: [
          {
            label: "Number of Students",
            data: Array.from(
              { length: selectedQuiz.totalQuestions + 1 },
              (_, i) => analytics.distribution[i] || 0
            ),
            backgroundColor: "rgba(16, 185, 129, 0.7)",
          },
        ],
      }
    : null;

  return (
    <div className="page">
      <header className="hero">
        <div className="course-badge">Foundations of AI for Business</div>
        <h1>Quiz Management Dashboard</h1>
        <p>Manage quizzes, search students, and visualize weekly quiz analytics.</p>
      </header>

      <section className="summary-grid">
        <div className="card stat">
          <div className="label">Total Students</div>
          <div className="value">{students.length}</div>
        </div>
        <div className="card stat">
          <div className="label">Total Quizzes</div>
          <div className="value">{quizzes.length}</div>
        </div>
        <div className="card stat">
          <div className="label">Selected Quiz Average</div>
          <div className="value small">
            {selectedQuiz && analytics
              ? `${analytics.average.toFixed(2)} / ${selectedQuiz.totalQuestions}`
              : "-"}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Students Scored</div>
          <div className="value">{analytics ? analytics.totalScored : 0}</div>
        </div>
      </section>

      <div className="tab-bar">
        <button
          className={activeTab === "input" ? "tab active" : "tab"}
          onClick={() => setActiveTab("input")}
        >
          Quiz Input
        </button>
        <button
          className={activeTab === "lookup" ? "tab active" : "tab"}
          onClick={() => setActiveTab("lookup")}
        >
          Student Lookup
        </button>
        <button
          className={activeTab === "analytics" ? "tab active" : "tab"}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </button>
      </div>

      {activeTab === "input" && (
        <section className="layout">
          <div className="left-column">
            <div className="card">
              <h2>Create Quiz</h2>
              <div className="form-grid">
                <input
                  placeholder="e.g. Week 3 Quiz"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                />
                <input
                  type="date"
                  value={quizDate}
                  onChange={(e) => setQuizDate(e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  value={quizTotalQuestions}
                  onChange={(e) => setQuizTotalQuestions(e.target.value)}
                />
                <button onClick={addQuiz}>Add Quiz</button>
              </div>
            </div>

            <div className="card">
              <h2>Add / Delete Student</h2>
              <div className="form-grid">
                <input
                  placeholder="Student name"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                />
                <input
                  placeholder="Student ID"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                />
                <input
                  placeholder="Department"
                  value={newStudentDepartment}
                  onChange={(e) => setNewStudentDepartment(e.target.value)}
                />
                <select
                  value={newStudentSection}
                  onChange={(e) => setNewStudentSection(e.target.value)}
                >
                  <option value="CS.40711">CS.40711</option>
                  <option value="BTM.40047">BTM.40047</option>
                </select>
                <button onClick={addStudent}>Add Student</button>
              </div>

              <div className="student-admin-list">
                {students.map((student) => (
                  <div className="student-admin-item" key={student.studentId}>
                    <div>
                      <strong>{student.name}</strong>
                      <div className="subtext">
                        {student.studentId} · {student.section} · {student.department}
                      </div>
                    </div>
                    <button className="danger" onClick={() => deleteStudent(student.studentId)}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="right-column">
            <div className="card">
              <h2>Enter Wrong Questions</h2>

              <label>Quiz</label>
              <select
                value={selectedQuizId}
                onChange={(e) => {
                  setSelectedQuizId(e.target.value);
                  setWrongQuestionsText("");
                }}
              >
                {quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title} · {quiz.date}
                  </option>
                ))}
              </select>

              <label>Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  loadExistingRecord(e.target.value);
                }}
              >
                {students.map((student) => (
                  <option key={student.studentId} value={student.studentId}>
                    {student.name} ({student.studentId}) - {student.section}
                  </option>
                ))}
              </select>

              <label>Wrong Question Numbers</label>
              <input
                placeholder="e.g. 2, 5, 8"
                value={wrongQuestionsText}
                onChange={(e) => setWrongQuestionsText(e.target.value)}
              />

              <div className="hint-text">
                Score is calculated automatically as total questions minus wrong answers.
              </div>

              <button onClick={saveWrongQuestions}>Save Record</button>
            </div>

            <div className="card">
              <h2>Quiz List</h2>
              <div className="quiz-list">
                {quizzes.map((quiz) => {
                  const stats = getQuizStats(quiz, students);
                  return (
                    <div className="quiz-item" key={quiz.id}>
                      <div>
                        <strong>{quiz.title}</strong>
                        <div className="subtext">
                          {quiz.date} · {quiz.totalQuestions} questions · Avg {stats.average.toFixed(2)}
                        </div>
                      </div>
                      <button className="danger" onClick={() => deleteQuiz(quiz.id)}>
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "lookup" && (
        <section className="single-column">
          <div className="card">
            <h2>Student Lookup</h2>
            <div className="toolbar">
              <input
                placeholder="Search by student name or student ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="student-list">
              {filteredStudents.map((student) => (
                <button
                  key={student.studentId}
                  className={lookupStudentId === student.studentId ? "student-item active" : "student-item"}
                  onClick={() => setLookupStudentId(student.studentId)}
                >
                  <div><strong>{student.name}</strong></div>
                  <div className="subtext">
                    {student.studentId} · {student.section} · {student.department}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Student Quiz Results</h2>
            {lookupStudent && (
              <div className="student-detail-header">
                <div><strong>{lookupStudent.name}</strong></div>
                <div className="subtext">
                  {lookupStudent.studentId} · {lookupStudent.section} · {lookupStudent.department}
                </div>
              </div>
            )}

            {lookupResults.length === 0 ? (
              <div className="empty-box">No quiz records found for this student.</div>
            ) : (
              <div className="result-list">
                {lookupResults.map((result) => (
                  <div className="result-item" key={result.quizId}>
                    <div className="result-top">
                      <strong>{result.title}</strong>
                      <span>{result.score} / {result.totalQuestions}</span>
                    </div>
                    <div className="subtext">{result.date}</div>
                    <div className="result-grid">
                      <div>
                        <div className="mini-label">Wrong Questions</div>
                        <div>{result.wrongQuestions.length ? result.wrongQuestions.join(", ") : "None"}</div>
                      </div>
                      <div>
                        <div className="mini-label">Section</div>
                        <div>{lookupStudent?.section}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "analytics" && selectedQuiz && analytics && (
        <section className="single-column">
          <div className="card">
            <h2>Analytics for {selectedQuiz.title}</h2>
            <label>Select Quiz</label>
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
            >
              {quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title} · {quiz.date}
                </option>
              ))}
            </select>

            <div className="analytics-summary">
              <div className="analytics-box">
                <div className="mini-label">Average Score</div>
                <div className="big-number">{analytics.average.toFixed(2)}</div>
              </div>
              <div className="analytics-box">
                <div className="mini-label">Students Included</div>
                <div className="big-number">{analytics.totalScored}</div>
              </div>
              <div className="analytics-box">
                <div className="mini-label">Total Questions</div>
                <div className="big-number">{selectedQuiz.totalQuestions}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Question-wise Wrong Answer Rate</h2>
            {wrongRateChartData && <Bar data={wrongRateChartData} />}
          </div>

          <div className="card">
            <h2>Score Distribution</h2>
            {scoreDistributionData && <Bar data={scoreDistributionData} />}
          </div>
        </section>
      )}
    </div>
  );
}
