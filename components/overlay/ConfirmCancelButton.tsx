import Button from '../button/Button';
import Loader from '../loader/Loader';

interface ConfirmCancelButtonProps {
  isPending?: boolean;
  onCancel?: () => void;
}

const ConfirmCancelButton = ({ isPending, onCancel }: ConfirmCancelButtonProps) => {
  return (
    <div className="w-full flex gap-4 mt-8 font-extrabold">
      <button type="button" className="px-4" onClick={onCancel}>
        Cancel
      </button>
      <Button
        type="submit"
        className={`w-full flex justify-center ${isPending ? 'opacity-25' : ''}`}
        disabled={isPending}
      >
        {isPending ? <Loader isDark={true} className="w-6 h-6" /> : 'Confirm'}
      </Button>
    </div>
  );
};

export default ConfirmCancelButton;
