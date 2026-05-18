// Random project IDs and secret tokens.

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

export function generateProjectId(): string {
    return `proj_${randomString(10, ID_ALPHABET)}`
}

export function generateToken(): string {
    return randomString(32, TOKEN_ALPHABET)
}
