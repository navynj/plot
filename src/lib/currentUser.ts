/** Auth is not on the roadmap yet; every request runs as this fixed dev user.
 *  Replace with real session lookup when auth lands. */
export function getCurrentUserId(): string {
  return 'dev-user';
}
