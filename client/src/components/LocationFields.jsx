import { useState } from 'react';

export default function LocationFields({ value, onChange, disabled = false, title = 'Campus location' }) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const update = (key) => (event) => onChange({ ...value, [key]: event.target.value });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Location access is not available in this browser.');
      return;
    }

    setError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({
          ...value,
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Allow location access or enter coordinates manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <fieldset className="location-fields" disabled={disabled}>
      <legend>{title} *</legend>
      <label className="field">
        <span>College / campus name</span>
        <input required maxLength={120} value={value.name} onChange={update('name')} placeholder="e.g. North Campus College" />
      </label>
      <button type="button" className="btn btn-outline btn-sm location-button" onClick={useCurrentLocation} disabled={disabled || locating}>
        {locating ? 'Getting location…' : 'Use current location'}
      </button>
      <div className="grid-2 location-coordinates">
        <label className="field">
          <span>Latitude</span>
          <input required type="number" min="-90" max="90" step="any" value={value.latitude} onChange={update('latitude')} placeholder="e.g. 12.971600" />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input required type="number" min="-180" max="180" step="any" value={value.longitude} onChange={update('longitude')} placeholder="e.g. 77.594600" />
        </label>
      </div>
      <small className="muted">Location access is optional and used only to match nearby requests within 2 km. Your exact coordinates are not shown to other users.</small>
      {error && <span className="field-error">{error}</span>}
    </fieldset>
  );
}
