// App-wide header. Shows project context and navigation when a project is
// open, otherwise a hint to pick one.

import {useState} from 'react'
import {NavLink, useNavigate} from 'react-router-dom'
import {useCurrentProject} from '../../store/projectsStore'
import {useChatStore} from '../../store/chatStore'
import ShareProjectModal from './ShareProjectModal'
import SyncIndicator from './SyncIndicator'

interface NavItem {
    to: string
    label: string
}

const PROJECT_NAV_ITEMS: NavItem[] = [
    {to: '', label: 'Kanban Board'},
    {to: 'notes', label: 'Notes'},
    {to: 'chat', label: 'Chat'},
    {to: 'calendar', label: 'Calendar'},
]

export default function Header() {
    const project = useCurrentProject()
    const navigate = useNavigate()
    const [showShare, setShowShare] = useState(false)
    const unreadCount = useChatStore(s => s.unreadCount)

    return (
        <>
            <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6 sticky top-0 z-10">
                <button
                    onClick={() => navigate('/')}
                    className="text-base font-semibold text-gray-800 shrink-0 hover:text-gray-600 transition-colors"
                >
                    The Project Planning Project
                </button>

                <span className="text-sm text-gray-400 shrink-0">.</span>

                {project ? (
                    <>
                        <span
                            className="text-sm font-medium text-gray-700 truncate max-w-[200px]"
                            title={project.name}
                        >
                            {project.name}
                        </span>

                        <nav className="flex items-center gap-1 overflow-x-auto flex-1">
                            {PROJECT_NAV_ITEMS.map(item => {
                                const path = item.to
                                    ? `/p/${project.id}/${item.to}`
                                    : `/p/${project.id}`

                                const isChatTab = item.to === 'chat'

                                return (
                                    <NavLink
                                        key={path}
                                        to={path}
                                        end={item.to === ''}
                                        className={({isActive}) => `
                                            relative text-sm px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap
                                            ${isActive
                                                ? 'bg-blue-50 text-blue-600 font-medium'
                                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                                            }
                                        `}
                                    >
                                        {item.label}

                                        {isChatTab && unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </NavLink>
                                )
                            })}
                        </nav>

                        <SyncIndicator/>

                        <button
                            onClick={() => setShowShare(true)}
                            className="text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-1.5 transition-colors shrink-0"
                        >
                            Share
                        </button>
                    </>
                ) : (
                    <span className="text-sm text-gray-400">
                        Select a project to begin working!
                    </span>
                )}
            </header>

            {showShare && project && (
                <ShareProjectModal
                    project={project}
                    onClose={() => setShowShare(false)}
                />
            )}
        </>
    )
}