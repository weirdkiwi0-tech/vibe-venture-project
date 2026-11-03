import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionForm } from '../../src/components/forms';
import { AnswerForm } from '../../src/components/answer-form';
import { createAnswer } from '../../src/lib/api';
import { uploadFiles } from '../../src/lib/uploads';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({ authResolved: true, authUser: { id: 'student', role: 'user' } }),
}));
jest.mock('../../src/lib/api', () => ({ createAnswer: jest.fn() }));
jest.mock('../../src/lib/uploads', () => ({ uploadFiles: jest.fn() }));

describe('upload forms', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('keeps question text and selected files when registration fails', async () => {
    const submit = jest.fn().mockRejectedValueOnce(new Error('파일 저장소에 연결할 수 없습니다.'))
      .mockResolvedValueOnce(undefined);
    const { container } = render(<QuestionForm onSubmit={submit} uploadProgress={50} />);
    const file = new File(['image'], 'question.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: 'Question title' } });
    fireEvent.change(screen.getByLabelText('본문'), { target: { value: 'Question body' } });
    await userEvent.upload(input, file);
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('파일 저장소에 연결할 수 없습니다.')).toBeInTheDocument();
    expect(input.files?.[0]).toBe(file);
    expect(screen.getByLabelText('제목')).toHaveValue('Question title');
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('질문이 등록되었습니다.')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('uploads answer files first and stores only their URLs', async () => {
    const url = 'http://localhost:3001/uploads/photo.png';
    jest.mocked(uploadFiles).mockResolvedValue([url]);
    jest.mocked(createAnswer).mockResolvedValue({} as Awaited<ReturnType<typeof createAnswer>>);
    const { container } = render(<AnswerForm questionId="question-1" />);
    const file = new File(['image'], 'answer.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('답변 내용'), { target: { value: 'Answer body' } });
    await userEvent.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    const getAll = FormData.prototype.getAll;
    jest.spyOn(FormData.prototype, 'getAll').mockImplementation(function (this: FormData, name: string) {
      return name === 'attachments' ? [file] : getAll.call(this, name);
    });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(createAnswer).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'question-1', attachments: [url], userId: 'student',
    })));
    expect(uploadFiles).toHaveBeenCalledWith([file], expect.any(Function));
  });
});