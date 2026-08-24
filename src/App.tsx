import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireAdmin from './components/RequireAdmin'
import RequireAuth from './components/RequireAuth'
import RequireProfile from './components/RequireProfile'
import AppShell from './components/layout/AppShell'
import TeacherShell from './components/layout/TeacherShell'
import { useAuthListener } from './hooks/useAuthListener'
import LandingPage from './pages/LandingPage'
import MockExamHome from './pages/MockExam/MockExamHome'
import MockExamResult from './pages/MockExam/MockExamResult'
import MockExamRun from './pages/MockExam/MockExamRun'
import OnboardingPage from './pages/OnboardingPage'
import ProfilePage from './pages/ProfilePage'
import RankingPage from './pages/RankingPage'
import ExamList from './pages/Teacher/Exams/ExamList'
import ExamMonitor from './pages/Teacher/Exams/ExamMonitor'
import ExamNew from './pages/Teacher/Exams/ExamNew'
import TeacherDashboard from './pages/Teacher/TeacherDashboard'
import TeacherLogin from './pages/Teacher/TeacherLogin'
import WordSetEditor from './pages/Teacher/WordSets/WordSetEditor'
import WordSetList from './pages/Teacher/WordSets/WordSetList'
import WordTestList from './pages/WordTest/WordTestList'
import WordTestResult from './pages/WordTest/WordTestResult'
import WordTestRun from './pages/WordTest/WordTestRun'
import WordTestStart from './pages/WordTest/WordTestStart'

export default function App() {
  useAuthListener()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/welcome" element={<OnboardingPage />} />

          <Route element={<RequireProfile />}>
            <Route element={<AppShell />}>
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/mock-exam" element={<MockExamHome />} />
              <Route path="/mock-exam/run" element={<MockExamRun />} />
              <Route path="/mock-exam/result/:attemptId" element={<MockExamResult />} />
              <Route path="/word-test" element={<WordTestList />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Proctored exam screens intentionally skip AppShell (fullscreen, no nav distractions). */}
            <Route path="/word-test/:sessionId" element={<WordTestStart />} />
            <Route path="/word-test/:sessionId/run" element={<WordTestRun />} />
            <Route path="/word-test/:sessionId/result" element={<WordTestResult />} />
          </Route>
        </Route>

        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route element={<RequireAdmin />}>
          <Route element={<TeacherShell />}>
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/word-sets" element={<WordSetList />} />
            <Route path="/teacher/word-sets/:setId" element={<WordSetEditor />} />
            <Route path="/teacher/exams" element={<ExamList />} />
            <Route path="/teacher/exams/new" element={<ExamNew />} />
            <Route path="/teacher/exams/:sessionId" element={<ExamMonitor />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
