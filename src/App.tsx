// Routing and shared layout shell. ProjectGuard wraps every project-scoped
// route and handles hydration plus sync setup.

import {BrowserRouter, Routes, Route, Outlet} from 'react-router-dom'
import Header from "./components/common/Header.tsx"
import HomePage from './pages/HomePage'
import KanbanPage from './pages/KanbanPage'
import NotesPage from './pages/NotesPage'
import ChatPage from './pages/ChatPage'
import CalendarPage from './pages/CalendarPage'
import AdminPage from './pages/AdminPage'
import ProjectGuard from './components/common/ProjectGuard'

function Layout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Header/>
            <main>
                <Outlet/>
            </main>
        </div>
    )
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout/>}>
                    <Route path="/" element={<HomePage/>}/>

                    <Route path="/p/:projectId" element={<ProjectGuard/>}>
                        <Route index element={<KanbanPage/>}/>
                        <Route path="notes" element={<NotesPage/>}/>
                        <Route path="chat" element={<ChatPage/>}/>
                        <Route path="calendar" element={<CalendarPage/>}/>
                        <Route path="admin" element={<AdminPage/>}/>
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App