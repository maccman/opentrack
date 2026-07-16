/**
 * Executes DELETE_ONLY regulations across configured destinations, mirroring the
 * per-destination reporting of Segment's regulation statuses: destinations that
 * cannot delete are reported as NOT_SUPPORTED rather than blocking the ones
 * that can.
 */

export type DestinationRegulationStatus = 'FINISHED' | 'RUNNING' | 'FAILED' | 'NOT_SUPPORTED'

export type RegulationStatus = 'FINISHED' | 'RUNNING' | 'PARTIAL_SUCCESS' | 'FAILED' | 'NOT_SUPPORTED'

export interface DestinationRegulationReport {
  name: string
  status: DestinationRegulationStatus
}

export interface RegulationResult {
  status: RegulationStatus
  destinations: DestinationRegulationReport[]
}

/** A destination able to delete a batch of users; RUNNING means "retry after the destination settles". */
export interface UserDeleter {
  deleteUsers(subjectIds: string[]): Promise<{ status: 'FINISHED' | 'RUNNING' }>
}

export interface RegulationDestination {
  name: string
  deleter: UserDeleter
}

function overallStatus(reports: DestinationRegulationReport[]): RegulationStatus {
  const active = reports.filter((report) => report.status !== 'NOT_SUPPORTED')
  if (active.length === 0) {
    return 'NOT_SUPPORTED'
  }
  const failed = active.filter((report) => report.status === 'FAILED').length
  if (failed === active.length) {
    return 'FAILED'
  }
  if (failed > 0) {
    return 'PARTIAL_SUCCESS'
  }
  return active.some((report) => report.status === 'RUNNING') ? 'RUNNING' : 'FINISHED'
}

export class RegulationService {
  /**
   * @param destinations destinations that support user deletion
   * @param unsupportedDestinations names of configured destinations that cannot delete (reported, never blocked on)
   */
  constructor(
    private readonly destinations: RegulationDestination[],
    private readonly unsupportedDestinations: string[]
  ) {}

  async deleteUsers(subjectIds: string[]): Promise<RegulationResult> {
    const settled = await Promise.allSettled(
      this.destinations.map((destination) => destination.deleter.deleteUsers(subjectIds))
    )

    const reports: DestinationRegulationReport[] = settled.map((outcome, index) => {
      const name = this.destinations[index].name
      if (outcome.status === 'rejected') {
        // Log only the destination and error type; provider messages can echo
        // subject identifiers or payload fragments.
        const reason: unknown = outcome.reason
        console.error('Privacy regulation destination failed', {
          destination: name,
          errorType: reason instanceof Error ? reason.constructor.name : typeof reason,
        })
        return { name, status: 'FAILED' }
      }
      return { name, status: outcome.value.status }
    })

    for (const name of this.unsupportedDestinations) {
      reports.push({ name, status: 'NOT_SUPPORTED' })
    }

    return { status: overallStatus(reports), destinations: reports }
  }
}
