import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { OPPORTUNITY_CATEGORIES } from '../../utils/helpers';
import './Opportunities.css';

export function StudentOpportunities() {
  const { state } = useApp();
  const { opportunities, currentUser, applications } = state;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Filter based on account type
  const accountTypeFilteredOpps = opportunities.filter(opp => {
    if (!currentUser) return false;
    
    // Admin sees all
    if (currentUser.role === 'ADMIN') return true;
    
    // OJT Student sees all
    if (currentUser.accountType === 'OJT Student') return true;
    
    // Training student sees: Internship, OJT, Youth Program, Training (except OJT-specific)
    if (currentUser.accountType === 'Training') {
      if (['Internship', 'OJT', 'Youth Program'].includes(opp.category)) return true;
      if (opp.category === 'Training' && opp.restrictedTo !== 'OJT') return true;
      return false;
    }
    
    return false;
  });

  const publishedOpportunities = accountTypeFilteredOpps.filter(o => o.status === 'Published');
  const myApplicationIds = applications
    .filter(app => app.studentId === currentUser?.id)
    .map(app => app.opportunityId);

  const filteredOpportunities = publishedOpportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.organization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || opp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleApply = (oppId) => {
    navigate('/opportunities/' + oppId);
  };

  return (
    <div className="student-opportunities-page">
      <h1 className="page-title">Opportunities</h1>
      
      <div className="opportunities-filters">
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
      </div>

      {filteredOpportunities.length > 0 ? (
        <div className="opportunities-grid">
          {filteredOpportunities.map((opp) => (
            <Card key={opp.id}>
              <div className="opportunity-card-badges">
                <Badge color="blue">{opp.category}</Badge>
              </div>
              <h3 className="opportunity-card-title">{opp.title}</h3>
              <p className="opportunity-card-org">{opp.organization}</p>
              <p className="opportunity-card-description">
                {opp.description.substring(0, 100)}...
              </p>
              <div className="opportunity-card-meta">
                <div>📍 {opp.location}</div>
                <div>⏰ {opp.requiredHours} hours</div>
              </div>
              {myApplicationIds.includes(opp.id) ? (
                <Badge color="green">Already Applied</Badge>
              ) : (
                <Button size="sm" onClick={() => handleApply(opp.id)} className="opportunity-apply-button">
                  View & Apply
                </Button>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🎯"
          title="No Opportunities Found"
          message="Try adjusting your search"
        />
      )}
    </div>
  );
}
