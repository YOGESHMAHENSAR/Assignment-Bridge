import ApiError from './ApiError.js';

export const MAX_TASK_DISTANCE_METERS = 2000;
const EARTH_RADIUS_METERS = 6378100;

const parseLocationInput = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new ApiError(400, 'Invalid location details');
  }
};

export const normalizeLocation = (input, label = 'Location') => {
  const value = parseLocationInput(input);
  const name = typeof value?.name === 'string' ? value.name.trim().slice(0, 120) : '';
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  const validCoordinate = (coordinate, number, minimum, maximum) =>
    (typeof coordinate === 'number' ||
      (typeof coordinate === 'string' && coordinate.trim() !== '')) &&
    Number.isFinite(number) && number >= minimum && number <= maximum;

  if (!name) throw new ApiError(400, `${label} name is required`);
  if (
    !validCoordinate(value?.latitude, latitude, -90, 90) ||
    !validCoordinate(value?.longitude, longitude, -180, 180)
  ) {
    throw new ApiError(400, `Enter valid coordinates for the ${label.toLowerCase()}`);
  }

  return {
    name,
    point: { type: 'Point', coordinates: [longitude, latitude] },
  };
};

export const hasLocationPoint = (location) =>
  location?.point?.type === 'Point' &&
  Array.isArray(location.point.coordinates) &&
  location.point.coordinates.length === 2 &&
  location.point.coordinates.every(Number.isFinite);

export const isWithinTaskRadius = (workerLocation, workLocation) => {
  if (!hasLocationPoint(workerLocation) || !hasLocationPoint(workLocation)) return false;
  const [workerLng, workerLat] = workerLocation.point.coordinates;
  const [taskLng, taskLat] = workLocation.point.coordinates;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(taskLat - workerLat);
  const lngDelta = toRadians(taskLng - workerLng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(workerLat)) * Math.cos(toRadians(taskLat)) * Math.sin(lngDelta / 2) ** 2;
  const distance = 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance <= MAX_TASK_DISTANCE_METERS;
};

export const taskRadiusQuery = (location) => {
  if (!hasLocationPoint(location)) {
    throw new ApiError(400, 'Add your campus location in your profile before browsing nearby requests');
  }

  return {
    'workLocation.point': {
      $geoWithin: {
        $centerSphere: [location.point.coordinates, MAX_TASK_DISTANCE_METERS / EARTH_RADIUS_METERS],
      },
    },
  };
};
