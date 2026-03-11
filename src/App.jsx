import { useEffect, useMemo, useState } from "react";
import { students } from "./students.js";

const STORAGE_KEY = "quiz-site-data-v1";

function parseWrongQuestions(text) {
  if (!text.trim()) return [];
  return [...new Set(
    text
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  )].sort((a, b) => a - b);
}

function scoreFromRecord(record, totalQuestions) {
  if (!record || !record.attended) return null;
  return Math.max(0, totalQuestions - (record.wrongQuestions?.length || 0));
}

function quizAverage(quiz) {
  const attended = Object.values(quiz.records || {}).filter((r) => r.attended);
  if (attended.length === 0) return 0;
  const sum = attended.reduce(
    (acc, r) => acc + scoreFromRecord(r, quiz.totalQuestions),
    0
  );
  return sum / attended.length;
}

export default function App() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(
    students[0]?.studentId || ""
  );
  const [sectionFilter, setSectionFilter] = useState("전체");
  const [search, setSearch] = useState("");

  const [quizTitle, setQuizTitle] = useState("");
  const [quizDate, setQuizDate] = useState("");
  const [quizTotalQuestions, setQuizTotalQuestions] = useState(10);

  const [inputStudentId, setInputStudentId] = useState(
    students[0]?.studentId || ""
  );
  const [attended, setAttended] = useState(true);
  const [wrongQuestionsText, setWrongQuestionsText] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setQuizzes(parsed);
          if (parsed.length > 0) setSelectedQuizId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error("localStorage parse error:", e);
    }

    const sample = [
      {
        id: "quiz-1",
        title: "Quiz 1",
        date: "2026-03-11",
        totalQuestions: 10,
        records: {
          "20220316": { attended: true, wrongQuestions: [2, 7] },
          "20220462": { attended: true, wrongQuestions: [5] },
          "20190280": { attended: true, wrongQuestions: [1, 9] }
        }
      }
    ];
    setQuizzes(sample);
    setSelectedQuizId("quiz-1");
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
    } catch (e) {
      console.error("localStorage save error:", e);
    }
  }, [quizzes]);

  const selectedQuiz = useMemo(() => {
    return quizzes.find((q) => q.id === selectedQuizId) || quizzes[0] || null;
  }, [quizzes, selectedQuizId]);

  const filteredStudents = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return students.filter((student) => {
      const sectionOk =
        sectionFilter === "전체" || student.section === sectionFilter;
      const searchOk =
        !keyword ||
        (student.name || "").toLowerCase().includes(keyword) ||
        (student.studentId || "").includes(keyword) ||
        (student.department || "").toLowerCase().includes(keyword);
      return sectionOk && searchOk;
    });
  }, [search, sectionFilter]);

  const selectedStudent =
    students.find((s) => s.studentId === selectedStudentId) || null;

  const studentResults = useMemo(() => {
    if (!selectedStudentId) return [];
    return quizzes
      .map((quiz) => {
        const record = quiz.records?.[selectedStudentId];
        if (!record?.attended) return null;
        return {
          quizId: quiz.id,
          title: quiz.title,
          date: quiz.date,
          score: scoreFromRecord(record, quiz.totalQuestions),
          totalQuestions: quiz.totalQuestions,
          wrongQuestions: record.wrongQuestions || [],
          average: quizAverage(quiz)
        };
      })
      .filter(Boolean);
  }, [quizzes, selectedStudentId]);

  function addQuiz() {
    if (!quizTitle.trim() || !quizDate || !quizTotalQuestions) return;

    const newQuiz = {
      id: `quiz-${Date.now()}`,
      title: quizTitle.trim(),
      date: quizDate,
      totalQuestions: Number(quizTotalQuestions),
      records: {}
    };

    const next = [newQuiz, ...quizzes];
    setQuizzes(next);
    setSelectedQuizId(newQuiz.id);

    setQuizTitle("");
    setQuizDate("");
    setQuizTotalQuestions(10);
  }

  function saveRecord() {
    if (!selectedQuiz) return;

    const wrongQuestions = attended
      ? parseWrongQuestions(wrongQuestionsText)
      : [];

    const next = quizzes.map((quiz) => {
      if (quiz.id !== selectedQuiz.id) return quiz;
      return {
        ...quiz,
        records: {
          ...quiz.records,
          [inputStudentId]: {
            attended,
            wrongQuestions
          }
        }
      };
    });

    setQuizzes(next);
    setWrongQuestionsText("");
  }

  function deleteQuiz(quizId) {
    const next = quizzes.filter((q) => q.id !== quizId);
    setQuizzes(next);
    setSelectedQuizId(next[0]?.id || "");
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>퀴즈 성적 관리 사이트</h1>
        <p>학생별 오답 문항, 점수, 출석자 기준 평균을 관리할 수 있습니다.</p>
      </header>

      <section className="summary-grid">
        <div className="card stat">
          <div className="label">전체 학생 수</div>
          <div className="value">{students.length}</div>
        </div>
        <div className="card stat">
          <div className="label">등록된 퀴즈 수</div>
          <div className="value">{quizzes.length}</div>
        </div>
        <div className="card stat">
          <div className="label">선택 퀴즈 출석 수</div>
          <div className="value">
            {selectedQuiz
              ? Object.values(selectedQuiz.records || {}).filter((r) => r.attended).length
              : 0}
          </div>
        </div>
        <div className="card stat">
          <div className="label">선택 퀴즈 평균</div>
          <div className="value small">
            {selectedQuiz
              ? `${quizAverage(selectedQuiz).toFixed(2)} / ${selectedQuiz.totalQuestions}`
              : "-"}
          </div>
        </div>
      </section>

      <section className="layout">
        <div className="left-column">
          <div className="card">
            <h2>새 퀴즈 추가</h2>
            <div className="form-grid">
              <input
                placeholder="예: 3주차 퀴즈"
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
              <button onClick={addQuiz}>퀴즈 추가</button>
            </div>
          </div>

          <div className="card">
            <h2>퀴즈 입력</h2>

            <label>대상 퀴즈</label>
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

            <label>학생</label>
            <select
              value={inputStudentId}
              onChange={(e) => setInputStudentId(e.target.value)}
            >
              {students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.name} ({student.studentId})
                </option>
              ))}
            </select>

            <label>출석 여부</label>
            <select
              value={attended ? "Y" : "N"}
              onChange={(e) => setAttended(e.target.value === "Y")}
            >
              <option value="Y">출석</option>
              <option value="N">결석</option>
            </select>

            <label>틀린 문항 번호 (쉼표 구분)</label>
            <input
              placeholder="예: 2,5,9"
              value={wrongQuestionsText}
              onChange={(e) => setWrongQuestionsText(e.target.value)}
            />

            <button onClick={saveRecord}>저장하기</button>
          </div>

          <div className="card">
            <h2>퀴즈 목록</h2>
            <div className="quiz-list">
              {quizzes.map((quiz) => (
                <div className="quiz-item" key={quiz.id}>
                  <div>
                    <strong>{quiz.title}</strong>
                    <div className="subtext">
                      {quiz.date} · 총 {quiz.totalQuestions}문항 · 평균 {quizAverage(quiz).toFixed(2)}
                    </div>
                  </div>
                  <button className="danger" onClick={() => deleteQuiz(quiz.id)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="right-column">
          <div className="card">
            <h2>학생별 조회</h2>

            <div className="toolbar">
              <input
                placeholder="이름, 학번, 학과 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
              >
                <option value="전체">전체</option>
                <option value="1분반">1분반</option>
                <option value="2분반">2분반</option>
              </select>
            </div>

            <div className="student-list">
              {filteredStudents.map((student) => (
                <button
                  key={student.studentId}
                  className={`student-item ${
                    selectedStudentId === student.studentId ? "active" : ""
                  }`}
                  onClick={() => setSelectedStudentId(student.studentId)}
                >
                  <div>
                    <strong>{student.name}</strong>
                  </div>
                  <div className="subtext">
                    {student.studentId} · {student.department} · {student.section}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>학생 상세 성적</h2>

            {selectedStudent && (
              <div className="student-detail-header">
                <div>
                  <strong>{selectedStudent.name}</strong>
                </div>
                <div className="subtext">
                  {selectedStudent.studentId} · {selectedStudent.department} · {selectedStudent.section}
                </div>
              </div>
            )}

            {studentResults.length === 0 ? (
              <div className="empty-box">출석 기록이 없습니다.</div>
            ) : (
              <div className="result-list">
                {studentResults.map((result) => (
                  <div className="result-item" key={result.quizId}>
                    <div className="result-top">
                      <strong>{result.title}</strong>
                      <span>
                        {result.score} / {result.totalQuestions}
                      </span>
                    </div>
                    <div className="subtext">{result.date}</div>

                    <div className="result-grid">
                      <div>
                        <div className="mini-label">틀린 문항</div>
                        <div>
                          {result.wrongQuestions.length
                            ? result.wrongQuestions.join(", ")
                            : "없음"}
                        </div>
                      </div>
                      <div>
                        <div className="mini-label">그날 평균</div>
                        <div>
                          {result.average.toFixed(2)} / {result.totalQuestions}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
