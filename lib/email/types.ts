/** An email, ready to send. Every part is plain strings, so it can be stored, logged in development and compared in tests. */
export interface Message {
  to: string
  subject: string
  text: string
  html: string
}

/** The same message before it has an address: what a template produces. */
export type Body = Omit<Message, "to">

export interface Transport {
  readonly name: "resend" | "memory" | "console"
  send(message: Message): Promise<void>
}
