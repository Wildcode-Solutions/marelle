ALTER TABLE questions
ADD COLUMN response_kind TEXT
CHECK (
  response_kind IS NULL OR response_kind IN (
    'multiple_choice',
    'true_false',
    'short_answer',
    'numeric',
    'fill_in_blank',
    'ordering',
    'matching'
  )
);

UPDATE questions
SET response_kind = kind
WHERE response_kind IS NULL;

ALTER TABLE questions
ADD COLUMN numeric_tolerance REAL
CHECK (numeric_tolerance IS NULL OR numeric_tolerance BETWEEN 0 AND 1000000000);

ALTER TABLE questions
ADD COLUMN answer_unit TEXT
CHECK (answer_unit IS NULL OR length(answer_unit) <= 30);

CREATE TABLE question_items (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  item_prompt TEXT,
  item_answer TEXT NOT NULL CHECK (length(item_answer) BETWEEN 1 AND 300),
  accepted_answers TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 12),
  UNIQUE (question_id, position)
);

CREATE INDEX idx_question_items_question_position
  ON question_items (question_id, position);
