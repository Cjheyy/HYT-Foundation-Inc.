import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicHeader } from './components/PublicHeader';
import { PublicFooter } from './components/PublicFooter';
import { StudentLayout } from './layouts/StudentLayout';
import { AdminLayout } from './layouts/AdminLayout';

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

// Student pages
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentProfile } from './pages/student/Profile';
import { StudentOpportunities } from './pages/student/Opportunities';
import { StudentApplications } from './pages/student/Applications';
import { StudentOJT } from './pages/student/OJT';
import { StudentAttendance } from './pages/student/Attendance';
import { StudentDailyReports } from './pages/student/DailyReports';
import { StudentCertificates } from './pages/student/Certificates';
import { StudentAnnouncements } from './pages/student/Announcements';
import { StudentRequirements } from './pages/student/Requirements';

// Admin pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminStudents } from './pages/admin/Students';
import { AdminPrograms } from './pages/admin/Programs';
import { AdminOpportunities } from './pages/admin/Opportunities';
import { AdminApplications } from './pages/admin/Applications';
import { AdminAttendance } from './pages/admin/Attendance';
import { AdminOJT } from './pages/admin/OJT';
import { AdminDailyReports } from './pages/admin/DailyReports';
import { AdminRequirements } from './pages/admin/Requirements';
import { AdminCertificates } from './pages/admin/Certificates';
import { AdminAnnouncements } from './pages/admin/Announcements';
import { AdminReports } from './pages/admin/Reports';

function PublicLayout({ children }) {
  return (
    <>
      <PublicHeader />
      {children}
      <PublicFooter />
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
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

          {/* Student Routes */}
          <Route path="/student" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentDashboard /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/profile" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentProfile /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/programs" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><Programs /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/opportunities" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentOpportunities /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/applications" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentApplications /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/requirements" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentRequirements /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/ojt" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentOJT /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/attendance" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentAttendance /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/daily-reports" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentDailyReports /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/certificates" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentCertificates /></StudentLayout>
            </ProtectedRoute>
          } />
          <Route path="/student/announcements" element={
            <ProtectedRoute requiredRole="STUDENT">
              <StudentLayout><StudentAnnouncements /></StudentLayout>
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
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
          <Route path="/admin/applications" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminApplications /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/attendance" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout><AdminAttendance /></AdminLayout>
            </ProtectedRoute>
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
