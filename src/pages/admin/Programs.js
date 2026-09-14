import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';

export function AdminPrograms() {
  const { state } = useApp();
  const { programs } = state;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Programs</h1>
        <Button onClick={() => alert('Create Program')}>Create Program</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {programs.map((program) => (
          <Card key={program.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{program.title}</h3>
                <p style={{ color: 'var(--muted-text)', marginTop: '8px' }}>{program.description.substring(0, 100)}...</p>
              </div>
              <Badge status={program.status}>{program.status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
