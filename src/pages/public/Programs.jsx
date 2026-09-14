import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { PROGRAM_CATEGORIES, HYT_THRUSTS } from '../../utils/helpers';
import './Programs.css';

export function Programs() {
  const { state } = useApp();
  const { programs } = state;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedThrust, setSelectedThrust] = useState('');

  const publishedPrograms = programs.filter(p => p.status === 'Published');

  const filteredPrograms = publishedPrograms.filter(program => {
    const matchesSearch = program.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         program.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || program.category === selectedCategory;
    const matchesThrust = !selectedThrust || program.thrusts.includes(selectedThrust);

    return matchesSearch && matchesCategory && matchesThrust;
  });

  return (
    <div className="programs-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Programs</h1>
          <p className="page-subtitle">
            Discover development programs designed to enhance your skills and capabilities
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="filters-section">
            <Input
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              placeholder="All Categories"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={PROGRAM_CATEGORIES}
            />
            <Select
              placeholder="All Thrusts"
              value={selectedThrust}
              onChange={(e) => setSelectedThrust(e.target.value)}
              options={HYT_THRUSTS}
            />
          </div>

          {filteredPrograms.length > 0 ? (
            <div className="programs-grid">
              {filteredPrograms.map((program) => (
                <Card 
                  key={program.id}
                  clickable
                  onClick={() => navigate(`/programs/${program.id}`)}
                  className="program-card"
                >
                  <div className="program-header">
                    <Badge status={program.status}>{program.status}</Badge>
                  </div>
                  <h3 className="program-title">{program.title}</h3>
                  <p className="program-description">
                    {program.description.substring(0, 150)}...
                  </p>
                  <div className="program-meta">
                    <div className="meta-item">
                      <span className="meta-icon">📚</span>
                      <span>{program.category}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">📅</span>
                      <span>{program.schedule}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">📍</span>
                      <span>{program.location}</span>
                    </div>
                  </div>
                  <div className="program-thrusts">
                    {program.thrusts.map((thrust, idx) => (
                      <span key={idx} className="thrust-tag">{thrust}</span>
                    ))}
                  </div>
                  <Button size="sm" style={{ width: '100%', marginTop: '16px' }}>
                    View Details
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📚"
              title="No Programs Found"
              message="Try adjusting your filters or search terms"
            />
          )}
        </div>
      </section>
    </div>
  );
}
