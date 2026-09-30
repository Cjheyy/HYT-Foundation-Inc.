import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicHeader } from './components/PublicHeader';
import { PublicFooter } from './components/PublicFooter';
import { StudentLayout } from './layouts/StudentLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { ScrollToTop } from './components/ScrollToTop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from 'react-toastify';
import { normalizeRole } from './services/supabaseService';
import 'react-toastify/dist/ReactToastify.css';

// Public pages
import { Home } from './pages/public/Home';
import { About } from './pages/public/About';
import { Programs } from './pages/public/Programs';
import { ProgramDetail } from './pages/public/ProgramDetail';
import { Opportunities } from './pages/public/Opportunities';
import { OpportunityDetail } from './pages/public/OpportunityDetail';
import { Impact } from './pages/public/Impact';
import { Contact } from './pages/public/Contact';
import { Login } from './pages/public/Login';
import { Register } from './pages/public/Register';
import { ForgotPassword } from './pages/public/ForgotPassword';
import { ResetPassword } from './pages/public/ResetPassword';
import { AuthConfirm } from './pages/public/AuthConfirm';

// Student pages
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentProfile } from './pages/student/Profile';
import { StudentOpportunities } from './pages/student/Opportunities';
import { StudentApplications } from './pages/student/Applications';
import { StudentOJT } from './pages/student/OJT';
import { AttendanceNew } from './pages/student/Attendance';
import { DailyReportsNew } from './pages/student/DailyReportsNew';
import { StudentCertificates } from './pages/student/Certificates';
import { StudentAnnouncements } from './pages/student/Announcements';
import { StudentRequirements } from './pages/student/Requirements';

// Trainee pages
import { TraineeDashboard } from './pages/trainee/Dashboard';
import { TraineeLayout } from './layouts/TraineeLayout';

// Admin pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminStudents } from './pages/admin/Students';
import { AdminPrograms } from './pages/admin/Programs';
import { AdminOpportunities } from './pages/admin/Opportunities';
import { AdminOJT } from './pages/admin/OJT';
import { AdminDailyReports } from './pages/admin/DailyReports';
import { AdminRequirements } from './pages/admin/Requirements';
import { AdminCertificates } from './pages/admin/Certificates';
import { AdminAnnouncements } from './pages/admin/Announcements';
import { AdminReports } from './pages/admin/Reports';
import { AttendanceVerification } from './pages/admin/AttendanceVerification';
import { OtApprovals } from './pages/admin/OtApprovals';
import { ReportApprovals } from './pages/admin/ReportApprovals';
import { ApplicationReview } from './pages/admin/ApplicationReview';

function PublicLayout({ children }) {
  return (
    <>
      <PublicHeader />
      {children}
      <PublicFooter />
    </>
  );
}

function SmartFallback() {
  const { state, authStatus } = useApp();
  const authenticated = authStatus === 'authenticated' && Boolean(state.currentUser);
  const role = normalizeRole(state.currentUser?.role);
  if (!authenticated) return <Navigate to="/" replace />;
  if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'OJT/INTERN') return <Navigate to="/student/dashboard" replace />;
  if (role === 'TRAINEE') return <Navigate to="/trainee/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
          <Route path="/programs" element={<PublicLayout><Programs /></PublicLayout>} />
          <Route path="/programs/:id" element={<PublicLayout><ProgramDetail /></PublicLayout>} />
          <Route path="/opportunities" element={<PublicLayout><Opportunities /></PublicLayout>} />
          <Route path="/opportunities/:id" element={<PublicLayout><OpportunityDetail /></PublicLayout>} />
          <Route path="/impact" element={<PublicLayout><Impact /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
          <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
          <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
          {/* Callback for Supabase {{ .TokenHash }} recovery/confirm emails. */}
          <Route path="/auth/confirm" element={<PublicLayout><AuthConfirm /></PublicLayout>} />

          {/* Student Routes (OJT/Intern) */}
          <Route path="/student/dashboard" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentDashboard /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentDashboard /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/profile" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentProfile /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/programs" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><Programs /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/opportunities" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentOpportunities /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/applications" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentApplications /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/requirements" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentRequirements /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/ojt" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentOJT /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/attendance" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><AttendanceNew /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/daily-reports" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><DailyReportsNew /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/certificates" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentCertificates /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/announcements" element={
            <ProtectedRoute requiredRole="OJT/Intern">
              <StudentLayout><StudentAnnouncements /></StudentLayout>
            </ProtectedRoute>
          } />

          {/* Trainee Routes */}
          <Route path="/trainee/dashboard" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><TraineeDashboard /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><TraineeDashboard /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/profile" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><StudentProfile /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/programs" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><Programs /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/opportunities" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><StudentOpportunities /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/applications" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><StudentApplications /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/requirements" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><StudentRequirements /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/attendance" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><AttendanceNew /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/daily-reports" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><DailyReportsNew /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/certificates" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><StudentCertificates /></TraineeLayout>
            </ProtectedRoute>
          } />
          <Route path="/trainee/announcements" element={
            <ProtectedRoute requiredRole="Trainee">
              <TraineeLayout><StudentAnnouncements /></TraineeLayout>
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminDashboard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminDashboard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/students" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminStudents /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/programs" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminPrograms /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/opportunities" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminOpportunities /></AdminLayout>
            </ProtectedRoute>
          } />
          {/* Legacy local-only applications page: its status updater ran purely
              in client memory and never persisted, so approvals silently
              vanished on refresh AND bypassed slot accounting. Redirect to the
              service-backed review page instead. */}
          <Route path="/admin/applications" element={
            <Navigate to="/admin/application-review" replace />
          } />
          {/* Legacy local-only attendance page: it never wrote to Supabase.
              Redirect instead of mounting a page whose approvals were fake. */}
          <Route path="/admin/attendance" element={
            <Navigate to="/admin/attendance-verification" replace />
          } />
          <Route path="/admin/attendance-review" element={
            <Navigate to="/admin/attendance-verification" replace />
          } />
          <Route path="/admin/ojt" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminOJT /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/daily-reports" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminDailyReports /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/requirements" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminRequirements /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/certificates" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminCertificates /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/announcements" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminAnnouncements /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminReports /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/attendance-verification" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AttendanceVerification /></AdminLayout>
            </ProtectedRoute>
          } />
          {/* Underscore alias used by older specs/bookmarks — same verification page. */}
          <Route path="/admin/attendance_verification" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AttendanceVerification /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/ot-approvals" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><OtApprovals /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/report-approvals" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><ReportApprovals /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/application-review" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><ApplicationReview /></AdminLayout>
            </ProtectedRoute>
          } />
          {/* Underscore alias used by older specs/bookmarks — same review page. */}
          <Route path="/admin/application_review" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><ApplicationReview /></AdminLayout>
            </ProtectedRoute>
          } />

          {/* Fallback: keep the user in context instead of forcing everyone to the landing page. */}
          <Route path="*" element={<SmartFallback />} />
        </Routes>
        
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </BrowserRouter>
    </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
