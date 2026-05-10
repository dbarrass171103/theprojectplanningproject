import {BrowserRouter, Routes, Route, Outlet} from 'react-router-dom'
import Header from './components/common/Header'
import KanbanPage from './pages/KanbanPage'
import NotesPage from './pages/NotesPage'


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
                    <Route path="/" element={<KanbanPage/>}/>
                    <Route path="/notes" element={<NotesPage/>}/>

                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App