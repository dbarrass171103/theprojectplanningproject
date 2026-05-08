interface PlaceholderPageProps {
    title: string
    description?: string
}

export default function PlaceholderPage({title, description}: PlaceholderPageProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="text-5xl mb-4 opacity-40">🚧</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">{title}</h2>
            <p className="text-sm text-gray-500 max-w-md">
                {description ?? "This feature isn't built yet. Coming soon."}
            </p>
        </div>
    )
}