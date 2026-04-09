"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-08

"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'students',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('name', sa.String(20), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(512), nullable=False),
        sa.Column('parent_pin_hash', sa.String(512), nullable=True),
        sa.Column('mascot_type', sa.String(20), nullable=False, server_default='penguin'),
        sa.Column('mascot_name', sa.String(20), nullable=True),
        sa.Column('onboarding_complete', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('current_session_id', sa.String(32), nullable=True),
    )

    op.create_table(
        'user_data',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('student_id', sa.String(32), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.Text, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.UniqueConstraint('student_id', 'key', name='uq_userdata_student_key'),
    )
    op.create_index('ix_userdata_student_id', 'user_data', ['student_id'])

    op.create_table(
        'skill_masteries',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('student_id', sa.String(32), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('skill_id', sa.String(100), nullable=False),
        sa.Column('mastery_level', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('attempts_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('correct_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_practiced', sa.DateTime, nullable=True),
        sa.Column('confidence_trend', sa.String(20), nullable=False, server_default='stable'),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.UniqueConstraint('student_id', 'skill_id', name='uq_skillmastery_student_skill'),
    )
    op.create_index('ix_skillmastery_student_id', 'skill_masteries', ['student_id'])

    op.create_table(
        'tutoring_sessions',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('student_id', sa.String(32), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('domain', sa.String(100), nullable=False),
        sa.Column('started_at', sa.DateTime, nullable=False),
        sa.Column('ended_at', sa.DateTime, nullable=True),
        sa.Column('skills_covered', sa.Text, nullable=False, server_default='[]'),
        sa.Column('session_summary', sa.Text, nullable=True),
    )
    op.create_index('ix_tutoringsession_student_id', 'tutoring_sessions', ['student_id'])

    op.create_table(
        'question_attempts',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('session_id', sa.String(32), sa.ForeignKey('tutoring_sessions.id'), nullable=False),
        sa.Column('skill_id', sa.String(100), nullable=False),
        sa.Column('question_text', sa.Text, nullable=False),
        sa.Column('student_answer', sa.Text, nullable=False),
        sa.Column('correct_answer', sa.Text, nullable=False),
        sa.Column('is_correct', sa.Boolean, nullable=False),
        sa.Column('time_spent_seconds', sa.Integer, nullable=True),
        sa.Column('hint_used', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('explanation_requested', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_questionattempt_session_id', 'question_attempts', ['session_id'])
    op.create_index('ix_questionattempt_skill_id', 'question_attempts', ['skill_id'])

    op.create_table(
        'writing_submissions',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('session_id', sa.String(32), sa.ForeignKey('tutoring_sessions.id'), nullable=False),
        sa.Column('prompt', sa.Text, nullable=False),
        sa.Column('essay_text', sa.Text, nullable=False),
        sa.Column('ai_feedback', sa.Text, nullable=True),
        sa.Column('scores_json', sa.Text, nullable=True),
        sa.Column('revision_of', sa.String(32), nullable=True),
        sa.Column('revision_number', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_writingsubmission_session_id', 'writing_submissions', ['session_id'])

    op.create_table(
        'question_cache',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('skill_id', sa.String(100), nullable=False),
        sa.Column('difficulty_tier', sa.Integer, nullable=False),
        sa.Column('question_text', sa.Text, nullable=False),
        sa.Column('answer_choices', sa.Text, nullable=False),
        sa.Column('correct_answer', sa.Text, nullable=False),
        sa.Column('explanation', sa.Text, nullable=False, server_default=''),
        sa.Column('used', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_questioncache_skill_tier_used', 'question_cache', ['skill_id', 'difficulty_tier', 'used'])


def downgrade() -> None:
    op.drop_table('question_cache')
    op.drop_table('writing_submissions')
    op.drop_table('question_attempts')
    op.drop_table('tutoring_sessions')
    op.drop_table('skill_masteries')
    op.drop_table('user_data')
    op.drop_table('students')
