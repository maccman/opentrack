import { z } from 'zod'

/**
 * Privacy regulation contract, modeled on Segment's Deletion and Suppression API.
 *
 * OpenTrack is stateless, so only `DELETE_ONLY` is supported: the regulation is
 * executed synchronously against every configured destination and nothing is
 * remembered afterwards. Suppression-style regulations require durable state
 * and are rejected.
 */

export const REGULATION_TYPES = ['DELETE_ONLY'] as const
export const REGULATION_SUBJECT_TYPES = ['USER_ID'] as const

export const MAX_REGULATION_SUBJECT_IDS = 100
export const MAX_REGULATION_SUBJECT_ID_LENGTH = 255

/** Matches the identifiers the ingestion API accepts, minus surrounding whitespace and control characters. */
const regulationSubjectIdSchema = z
  .string()
  .min(1)
  .max(MAX_REGULATION_SUBJECT_ID_LENGTH)
  .refine((value) => value.trim() === value, { message: 'subjectIds must not have surrounding whitespace' })

  .refine((value) => !/[\u0000-\u001F\u007F]/u.test(value), {
    message: 'subjectIds must not contain control characters',
  })

export const createRegulationRequestSchema = z
  .object({
    regulationType: z.enum(REGULATION_TYPES),
    subjectType: z.enum(REGULATION_SUBJECT_TYPES),
    subjectIds: z.array(regulationSubjectIdSchema).min(1).max(MAX_REGULATION_SUBJECT_IDS),
  })
  .strict()

export type CreateRegulationRequest = z.infer<typeof createRegulationRequestSchema>
