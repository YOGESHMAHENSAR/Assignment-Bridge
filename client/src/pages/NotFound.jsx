import { Link } from 'react-router-dom';
import { Empty } from '../components/ui';

export default function NotFound() {
  return (
    <Empty title="Page not found">
      <Link to="/" className="btn btn-primary">
        Go home
      </Link>
    </Empty>
  );
}
