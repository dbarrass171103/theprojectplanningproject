import {useState} from 'react'
import {NavLink, useNavigate} from 'react-router-dom'
import {useCurrentProject} from '../../store/projectsStore'
import ShareProjectModal from './ShareProjectModal'
import SyncIndicator from './SyncIndicator'

// Interface for a navigation item
interface NavItem {
    to: string
    label: string
}

// List of nav items shown in the heading
const PROJECT_NAV_ITEMS: NavItem[] = [
    {to: '', label: 'Kanban Board'},
    {to: 'notes', label: 'Notes'},
]

export default function Header() {
    // Gets the currently selected project
    const project = useCurrentProject()

    // Router navigation function
    const navigate = useNavigate()

    // Local state controlling whether the Share modal is open
    const [showShare, setShowShare] = useState(false)

    return (
        <>
            <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6 sticky top-0 z-10">

                {/* App title — clicking returns to home */}
                <button
                    onClick={() => navigate('/')}
                    className="text-base font-semibold text-gray-800 shrink-0 hover:text-gray-600 transition-colors"
                >
                    The Project Planning Project
                </button>

                {/* Divider dot */}
                        <span className="text-sm text-gray-400 shrink-0">.</span>

                {/* If a project is selected, show project UI */}
                {project ? (
                    <>
                        {/* Project name */}
                        <span
                            className="text-sm font-medium text-gray-700 truncate max-w-[200px]"
                            title={project.name}
                        >
                            {project.name}
                        </span>

                        {/* Navigation tabs */}
                        <nav className="flex items-center gap-1 overflow-x-auto flex-1">
                            {PROJECT_NAV_ITEMS.map(item => {
                                // Build the correct path for each tab
                                const path = item.to
                                    ? `/p/${project.id}/${item.to}`
                                    : `/p/${project.id}`

                                return (
                                    <NavLink
                                        key={path}
                                        to={path}
                                        end={item.to === ''} // exact match for root tab
                                        className={({isActive}) => `
                                            text-sm px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap
                                            ${isActive
                                                ? 'bg-blue-50 text-blue-600 font-medium'
                                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                                            }
                                        `}
                                    >
                                        {item.label}
                                    </NavLink>
                                )
                            })}
                        </nav>

                        {/* Sync status indicator */}
                        <SyncIndicator/>

                        {/* Share button opens modal */}
                        <button
                            onClick={() => setShowShare(true)}
                            className="text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-1.5 transition-colors shrink-0"
                        >
                            Share
                        </button>
                    </>
                ) : (
                    // If no project selected
                    <span className="text-sm text-gray-400">Select a project to begin working!</span>
                )}
            </header>

            {/* Share modal (only shown when toggled on) */}
            {showShare && project && (
                <ShareProjectModal
                    project={project}
                    onClose={() => setShowShare(false)}
                />
            )}
        </>
    )
}
