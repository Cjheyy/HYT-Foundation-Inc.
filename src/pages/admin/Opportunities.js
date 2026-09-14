import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';

export function AdminOpportunities() {
  const { state } = useApp();
  const { opportunities } = state;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Opportunities</h1>
        <Button onClick={() => alert('Create Opportunity')}>Create Opportunity</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {opportunities.map((opp) => (
          <Card key={opp.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{opp.title}</h3>
                <p style={{ color: 'var(--primary-orange)', marginBottom: '4px' }}>{opp.organization}</p>
                <p style={{ color: 'var(--muted-text)' }}>{opp.description.substring(0, 100)}...</p>
              </div>
              <Badge status={opp.status}>{opp.status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
