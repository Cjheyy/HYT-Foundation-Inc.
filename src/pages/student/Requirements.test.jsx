import { render, screen, fireEvent } from '@testing-library/react';
import { StudentRequirements, formatFileSize, validateRequirementFile } from './Requirements';

let mockState = {};

jest.mock('../../context/AppContext', () => ({
  useApp: () => ({ state: mockState, dispatch: jest.fn() })
}));

const makeFile = (name, size, type = '') => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const requirementsState = () => ({
  currentUser: { id: 'user-1', fullName: 'Juan Dela Cruz', role: 'OJT/Intern' },
  dataLoading: false,
  requirements: [
    { id: 'r1', studentId: 'user-1', name: 'NSC', description: 'Birth certificate copy', status: 'Required' },
    { id: 'r2', studentId: 'user-1', name: 'Good Moral', description: 'From your school', status: 'Approved' }
  ]
});

// Opens the upload dialog and returns the dropzone's <input type="file">,
// resolved through the wrapping <label> instead of a DOM traversal.
const openUploadDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  return screen.getByLabelText(/Drop your file here/);
};

describe('formatFileSize', () => {
  test('formats bytes, kilobytes and megabytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  test('never prints NaN', () => {
    expect(formatFileSize(undefined)).toBe('0 KB');
    expect(formatFileSize(NaN)).toBe('0 KB');
    expect(formatFileSize(-5)).toBe('0 KB');
  });
});

describe('validateRequirementFile', () => {
  test('accepts a normal PDF', () => {
    expect(validateRequirementFile(makeFile('nsc.pdf', 1024, 'application/pdf'))).toBe('');
  });

  test('accepts a JPEG with no MIME type but a good extension', () => {
    expect(validateRequirementFile(makeFile('id.JPG', 2048))).toBe('');
  });

  test('rejects an unsupported type', () => {
    expect(validateRequirementFile(makeFile('notes.docx', 1024, 'application/msword')))
      .toMatch(/PDF, JPG or PNG/);
  });

  test('rejects a file over 10 MB', () => {
    expect(validateRequirementFile(makeFile('big.pdf', 11 * 1024 * 1024, 'application/pdf')))
      .toMatch(/limit is 10 MB/);
  });

  test('rejects an empty file', () => {
    expect(validateRequirementFile(makeFile('empty.pdf', 0, 'application/pdf')))
      .toMatch(/empty/);
  });

  test('rejects a missing file', () => {
    expect(validateRequirementFile(null)).toMatch(/choose a file/);
  });
});

describe('StudentRequirements', () => {
  beforeEach(() => {
    mockState = requirementsState();
  });

  test('lists only the signed-in user requirements', () => {
    render(<StudentRequirements />);
    expect(screen.getByText('NSC')).toBeInTheDocument();
    expect(screen.getByText('Good Moral')).toBeInTheDocument();
  });

  test('shows a loading state while portal data is loading', () => {
    mockState = { ...requirementsState(), dataLoading: true };
    render(<StudentRequirements />);
    expect(screen.getByRole('status', { name: 'Loading your requirements' })).toBeInTheDocument();
    expect(screen.queryByText('NSC')).toBeNull();
  });

  test('offers an upload dialog with a dropzone instead of a file-name field', () => {
    render(<StudentRequirements />);
    const input = openUploadDialog();

    // The old modal asked the user to type a file name into a text input.
    expect(input).toHaveAttribute('type', 'file');
    expect(screen.getByText(/PDF, JPG or PNG/)).toBeInTheDocument();
  });

  test('shows a file chip after choosing a valid file', () => {
    render(<StudentRequirements />);
    const input = openUploadDialog();

    fireEvent.change(input, { target: { files: [makeFile('nsc.pdf', 2048, 'application/pdf')] } });

    expect(screen.getByText('nsc.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
  });

  test('rejects an unsupported file with a visible error', () => {
    render(<StudentRequirements />);
    const input = openUploadDialog();

    fireEvent.change(input, { target: { files: [makeFile('notes.docx', 1024, 'application/msword')] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/PDF, JPG or PNG/);
    expect(screen.queryByText('notes.docx')).toBeNull();
  });

  test('removes the selected file', () => {
    render(<StudentRequirements />);
    const input = openUploadDialog();

    fireEvent.change(input, { target: { files: [makeFile('nsc.pdf', 2048, 'application/pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('nsc.pdf')).toBeNull();
  });

  test('never shows the old placeholder help text', () => {
    render(<StudentRequirements />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(screen.queryByText(/In a real application/)).toBeNull();
    expect(screen.queryByText('File Name')).toBeNull();
  });
});
