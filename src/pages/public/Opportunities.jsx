import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { OPPORTUNITY_CATEGORIES, HYT_THRUSTS } from '../../utils/helpers';
import './Opportunities.css';

export function Opportunities() {
  const { state } = useApp();
  const { opportunities } = state;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedThrust, setSelectedThrust] = useState('');

  const publishedOpportunities = opportunities.filter(o => o.status === 'Published');

  const filteredOpportunities = publishedOpportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || opp.category === selectedCategory;
    const matchesThrust = !selectedThrust || opp.thrusts.includes(selectedThrust);

    return matchesSearch && matchesCategory && matchesThrust;
  });

  return (
    <div className="opportunities-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Opportunities</h1>
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
              {filteredOpportunities.map((opp) => (
                <Card 
                  key={opp.id}
                  clickable
                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                  className="opportunity-card"
                >
                  <div className="opportunity-header">
                    <Badge color="blue">{opp.category}</Badge>
                    <Badge color="green">{opp.availableSlots} slots</Badge>
                  </div>
                  <h3 className="opportunity-title">{opp.title}</h3>
                  <p className="opportunity-org">{opp.organization}</p>
                  <p className="opportunity-description">
                    {opp.description.substring(0, 120)}...
                  </p>
                  <div className="opportunity-meta">
                    <div className="meta-item">
                      <span className="meta-icon">📍</span>
                      <span>{opp.location}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">⏰</span>
                      <span>{opp.requiredHours} hours</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">🏢</span>
                      <span>{opp.setup}</span>
                    </div>
                  </div>
                  <div className="opportunity-thrusts">
                    {opp.thrusts.slice(0, 3).map((thrust, idx) => (
                      <span key={idx} className="thrust-tag">{thrust}</span>
                    ))}
                  </div>
                  <Button size="sm" style={{ width: '100%', marginTop: '16px' }}>
                    View Details & Apply
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🎯"
              title="No Opportunities Found"
              message="Try adjusting your filters or search terms"
            />
          )}
        </div>
      </section>
    </div>
  );
}
