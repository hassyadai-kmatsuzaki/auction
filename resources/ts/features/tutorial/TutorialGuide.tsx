import { useEffect, useState } from 'react';
import {
  Box, Stepper, Step, StepLabel, StepContent, Button, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip,
} from '@mui/material';
import { School, CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from '../../lib/axios';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string | null;
  completed: boolean;
}

interface TutorialGuideProps {
  role: 'participant' | 'seller' | 'admin';
}

export default function TutorialGuide({ role }: TutorialGuideProps) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/tutorials?role=${role}`)
      .then(res => {
        const data = res.data.data;
        setSteps(data);

        // 初回訪問（全ステップ未完了）で自動表示
        const allNew = data.every((s: TutorialStep) => !s.completed);
        if (allNew && data.length > 0) {
          setOpen(true);
        }

        const firstIncomplete = data.findIndex((s: TutorialStep) => !s.completed);
        if (firstIncomplete >= 0) setActiveStep(firstIncomplete);
      })
      .finally(() => setLoading(false));
  }, [role]);

  const handleComplete = async (stepId: string) => {
    await axios.post('/api/tutorials/complete', { step_id: stepId });
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, completed: true } : s));
    setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const completedCount = steps.filter(s => s.completed).length;

  if (loading || steps.length === 0) return null;

  return (
    <>
      {/* チュートリアル開始ボタン */}
      <Button
        size="small"
        startIcon={<School />}
        onClick={() => setOpen(true)}
        sx={{ textTransform: 'none' }}
      >
        ガイド ({completedCount}/{steps.length})
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <School color="primary" />
          はじめてガイド
          <Chip label={`${completedCount}/${steps.length}`} size="small" color="primary" variant="outlined" />
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.id} completed={step.completed}>
                <StepLabel
                  icon={step.completed ? <CheckCircle color="success" /> : undefined}
                  onClick={() => setActiveStep(index)}
                  sx={{ cursor: 'pointer' }}
                >
                  {step.title}
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {step.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {step.target && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          navigate(step.target!);
                          setOpen(false);
                        }}
                      >
                        ページを開く
                      </Button>
                    )}
                    {!step.completed && (
                      <Button
                        size="small"
                        onClick={() => handleComplete(step.id)}
                      >
                        完了にする
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
