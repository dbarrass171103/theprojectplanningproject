// Root of the React application — sets up routing and the shared Layout shell.
//
// Route structure:
//   /               → HomePage (project list + creation)
//   /p/:projectId   → ProjectGuard wraps all project-scoped routes.
//                     The guard handles join-on-first-visit, store hydration,
//                     and sync engine lifecycle before rendering children.
//       (index)     → KanbanPage
//       notes       → NotesPage
//
// Layout wraps every route with the Header and a <main> container. It renders
// via <Outlet/> so nested routes can replace the main content area freely.

import {BrowserRouter, Routes, Route, Outlet} from 'react-router-dom'
import Header from "./components/common/Header.tsx";
import HomePage from './pages/HomePage'
import KanbanPage from './pages/KanbanPage'
import NotesPage from './pages/NotesPage'
import ProjectGuard from './components/common/Projectguard'

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

                    {/* ProjectGuard sits above the project-scoped routes so it
                        can bootstrap state before any child page renders. */}
                    <Route path="/p/:projectId" element={<ProjectGuard/>}>
                        <Route index element={<KanbanPage/>}/>
                        <Route path="notes" element={<NotesPage/>}/>
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App
