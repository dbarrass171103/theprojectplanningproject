import {NavLink} from 'react-router-dom'

interface NavItem {
    to: string
    label: string
}

const NAV_ITEMS: NavItem[] = [
    {to: '/', label: 'Board'},
    {to: '/gantt', label: 'Gantt'},
    {to: '/tasks', label: 'Tasks'},
    {to: '/calendar', label: 'Calendar'},
    {to: '/notes', label: 'Notes'},
    {to: '/settings', label: 'Settings'},
]

export default function Header() {
    return (
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6 sticky top-0 z-10">
            <h1 className="text-base font-semibold text-gray-800 shrink-0">
                The Project Planning Project
            </h1>

            <nav className="flex items-center gap-1 overflow-x-auto">
                {NAV_ITEMS.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
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
                ))}
            </nav>
        </header>
    )
}