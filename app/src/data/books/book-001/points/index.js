import ch11Points from './ch_11.js'

export const pointsByChapter = {
  ch_11: ch11Points,
}

const allPoints = Object.values(pointsByChapter).flat()

const duplicates = allPoints
  .map(point => point.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index)

if (duplicates.length > 0) {
  throw new Error(`Duplicate point ids: ${[...new Set(duplicates)].join(', ')}`)
}

export const pointMap = Object.fromEntries(
  allPoints.map(point => [point.id, point]),
)
