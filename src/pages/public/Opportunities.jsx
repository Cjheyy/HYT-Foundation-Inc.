import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/icons';
import { OPPORTUNITY_CATEGORIES, HYT_THRUSTS } from '../../utils/helpers';
import { isEventActive, getEventSlotState } from '../../services/supabaseService';
import './Opportunities.css';

export function Opportunities() {
  const { state } = useApp();
  const { opportunities } = state;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedThrust, setSelectedThrust] = useState('');

  const publishedOpportunities = opportunities.filter((opportunity) =>
    String(opportunity.status).toLowerCase() === 'published' && isEventActive(opportunity)
  );

  const filteredOpportunities = publishedOpportunities.filter(opp => {
    const matchesSearch = String(opp.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         String(opp.organization || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         String(opp.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || opp.category === selectedCategory;
    const thrusts = Array.isArray(opp.thrusts) ? opp.thrusts : [];
    const matchesThrust = !selectedThrust || thrusts.includes(selectedThrust);

    return matchesSearch && matchesCategory && matchesThrust;
  });

  return (
    <div className="opportunities-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">OJT Postings</h1>
          <p className="page-subtitle">
            Explore internships, OJT programs, training, and community opportunities
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="filters-section">
            <Input
              placeholder="Search opportunities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              placeholder="All Categories"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={OPPORTUNITY_CATEGORIES}
            />
            <Select
              placeholder="All Thrusts"
              value={selectedThrust}
              onChange={(e) => setSelectedThrust(e.target.value)}
              options={HYT_THRUSTS}
            />
          </div>

          {filteredOpportunities.length > 0 ? (
            <div className="opportunities-grid">
              {filteredOpportunities.map((opp) => {
                const slots = getEventSlotState(opp);
                return (
                  <Card
                    key={opp.id}
                    clickable
                    onClick={() => navigate(`/opportunities/${opp.id}`)}
                    className="opportunity-card"
                  >
                    <div className="opportunity-header">
                      <Badge color="blue">{opp.category}</Badge>
                      <Badge color={slots.isFull ? 'red' : 'green'}>
                        {slots.isFull ? 'Full' : `${slots.available} slots`}
                      </Badge>
                    </div>
                    <h3 className="opportunity-title">{opp.title}</h3>
                    <p className="opportunity-org">{opp.organization}</p>
                    <p className="opportunity-description">
                      {String(opp.description || '').substring(0, 120)}{opp.description?.length > 120 ? '...' : ''}
                    </p>
                    <div className="opportunity-meta">
                      <div className="meta-item">
                        <span className="meta-icon"><Icon name="pin" size={15} /></span>
                        <span>{opp.location}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-icon"><Icon name="clock" size={15} /></span>
                        <span>{opp.requiredHours} hours</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-icon"><Icon name="briefcase" size={15} /></span>
                        <span>{opp.setup}</span>
                      </div>
                    </div>
                    <div className="opportunity-thrusts">
                      {(Array.isArray(opp.thrusts) ? opp.thrusts : []).slice(0, 3).map((thrust, idx) => (
                        <span key={idx} className="thrust-tag">{thrust}</span>
                      ))}
                    </div>
                    <Button size="sm" style={{ width: '100%', marginTop: '16px' }}>
                      View Details & Apply
                    </Button>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="target"
              title="No Opportunities Found"
              message="Try adjusting your filters or search terms"
            />
          )}
        </div>
      </section>
    </div>
  );
}
