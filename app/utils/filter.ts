/**
 * Browser-compatible filter utility for matching file IDs against patterns
 * Replaces @rollup/pluginutils which depends on Node.js APIs
 */

export type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null

type Matcher = (id: string) => boolean

/**
 * Creates a filter function for file IDs based on include/exclude patterns
 * @param include - Pattern(s) to include (default: match all)
 * @param exclude - Pattern(s) to exclude (default: none)
 * @returns Filter function that tests file IDs
 */
export function createFilter(
  include?: FilterPattern,
  exclude?: FilterPattern,
): (id: string) => boolean {
  const includeMatchers = toMatchers(include)
  const excludeMatchers = toMatchers(exclude)

  return (id: string) => {
    // If exclude patterns match, reject the file
    if (excludeMatchers.length > 0 && testMatchers(id, excludeMatchers)) {
      return false
    }

    // If no include patterns, accept all (unless excluded above)
    if (includeMatchers.length === 0) {
      return true
    }

    // Accept if any include pattern matches
    return testMatchers(id, includeMatchers)
  }
}

/**
 * Converts FilterPattern to an array of matcher functions
 */
function toMatchers(pattern?: FilterPattern): Matcher[] {
  if (!pattern)
    return []

  const patterns = Array.isArray(pattern) ? pattern : [pattern]

  return patterns.map((p): Matcher => {
    if (p instanceof RegExp) {
      return id => p.test(id)
    }
    else {
      // Convert glob-like string pattern to RegExp
      // Simple implementation: convert * to .*, escape special regex chars
      const regexPattern = p
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
        .replace(/\*/g, '.*') // Convert * to .*
      const regex = new RegExp(regexPattern)
      return id => regex.test(id)
    }
  })
}

/**
 * Tests if a string matches any of the given matcher functions
 */
function testMatchers(str: string, matchers: Matcher[]): boolean {
  return matchers.some(matcher => matcher(str))
}
