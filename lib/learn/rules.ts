/**
 * Validation rules shared by the server actions and the scenario detector,
 * so the two can never drift apart.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const PASSWORD_SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/

export const FIRST_NAME_MAX = 30
export const FIRST_NAME_RE = /^[a-zA-Z\s\-']+$/

export const AGE_MIN = 18
export const AGE_MAX = 99

export const TEXT_AREA_MAX = 200

export const FILE_TYPES = ["image/jpeg", "image/png", "image/gif"] as const
export const FILE_MAX_BYTES = 5 * 1024 * 1024
