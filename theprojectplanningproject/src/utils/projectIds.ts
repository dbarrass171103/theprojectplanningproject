// Generates short random project IDs and longer random secret tokens.
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function randomString(length: number, alphabet: string): string {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    let out = ''
    for (let i = 0; i < length; i++) {
        out += alphabet[bytes[i] % alphabet.length]
    }
    return out
}

// Project IDs (somewhat short making them easier to recognize)
export function generateProjectId(): string {
    return `proj_${randomString(10, ID_ALPHABET)}`
}

// Secret token
export function generateToken(): string {
    return randomString(32, TOKEN_ALPHABET)
}