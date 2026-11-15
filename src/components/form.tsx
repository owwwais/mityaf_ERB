"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/validation";
import { useCloseModal } from "./modal";
import { cx } from "./ui";

type FormAction = (formData: FormData) => Promise<ActionResult>;

const FormContext = createContext<{ errors: Record<string, string>; pending: boolean }>({ errors: {}, pending: false });

/**
 * نموذج يستدعي Server Action ويعرض أخطاء التحقق تحت حقولها.
 * لا يمسح ما كتبه المستخدم عند الخطأ، ويغلق النافذة المحيطة عند النجاح.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "حفظ",
  className,
  onSuccess,
  keepOpen,
  secondary,
  successMessage,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel?: ReactNode;
  className?: string;
  onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void;
  /** لا تغلق النافذة بعد الحفظ (للإدخال المتتابع). */
  keepOpen?: boolean;
  secondary?: ReactNode;
  successMessage?: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const closeModal = useCloseModal();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const res = await action(formData);
      setResult(res);
      if (res.ok) {
        onSuccess?.(res);
        if (closeModal && !keepOpen) closeModal();
        else formRef.current?.reset();
      }
    });
  }

  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <FormContext.Provider value={{ errors, pending }}>
      <form ref={formRef} onSubmit={onSubmit} noValidate>
        <div className={className}>{children}</div>
        {result && !result.ok && (
          <p role="alert" className="mt-4 rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {result.message}
          </p>
        )}
        {result?.ok && (successMessage || result.message) && !closeModal && (
          <p role="status" className="mt-4 rounded-sm border border-success/25 bg-success-soft px-3 py-2 text-sm text-success">
            {result.message ?? successMessage}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary min-w-24" disabled={pending}>
            {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
            {submitLabel}
          </button>
          {closeModal && (
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              إلغاء
            </button>
          )}
          {secondary}
        </div>
      </form>
    </FormContext.Provider>
  );
}

function FieldShell({
  label,
  name,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { errors } = useContext(FormContext);
  const error = errors[name];
  return (
    <div className={className}>
      <label className="label" htmlFor={`f-${name}`}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p>
      )}
    </div>
  );
}

function useInvalid(name: string) {
  const { errors } = useContext(FormContext);
  return errors[name] ? true : undefined;
}

type BaseProps = { label: string; name: string; hint?: ReactNode; className?: string };

export function TextField({ label, name, hint, className, ...rest }: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "className">) {
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className}>
      <input id={`f-${name}`} name={name} className="input" aria-invalid={invalid} autoComplete="off" {...rest} />
    </FieldShell>
  );
}

/** حقل رقمي يقبل الأرقام العربية واللاتينية ويُظهر لوحة الأرقام على الجوال. */
export function NumberField({
  label,
  name,
  hint,
  className,
  suffix,
  ...rest
}: BaseProps & { suffix?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "className" | "type">) {
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className}>
      <div className="relative">
        <input
          id={`f-${name}`}
          name={name}
          type="text"
          inputMode="decimal"
          dir="ltr"
          className={cx("input text-right", suffix && "pl-12")}
          aria-invalid={invalid}
          autoComplete="off"
          {...rest}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-ink-3">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

export function DateField({ label, name, hint, className, ...rest }: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "className" | "type">) {
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className}>
      <input id={`f-${name}`} name={name} type="date" className="input" aria-invalid={invalid} {...rest} />
    </FieldShell>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  label,
  name,
  hint,
  className,
  options,
  placeholder,
  ...rest
}: BaseProps & { options: Option[]; placeholder?: string } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "className">) {
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className}>
      <select id={`f-${name}`} name={name} className="input" aria-invalid={invalid} {...rest}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, name, hint, className, ...rest }: BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "className">) {
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className}>
      <textarea id={`f-${name}`} name={name} className="input" rows={3} aria-invalid={invalid} {...rest} />
    </FieldShell>
  );
}

export function CheckboxField({ label, name, hint, defaultChecked }: { label: string; name: string; hint?: ReactNode; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-4 accent-[var(--accent)]" />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs leading-relaxed text-ink-3">{hint}</span>}
      </span>
    </label>
  );
}

/** زر ينفّذ إجراءً بعد تأكيد (حذف، تغيير حالة…). */
export function ActionButton({
  action,
  confirm,
  children,
  className = "btn btn-ghost btn-sm",
  label,
}: {
  action: () => Promise<ActionResult>;
  confirm?: string;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const res = await action();
          if (!res.ok) window.alert(res.message);
        });
      }}
    >
      {pending ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : children}
    </button>
  );
}

export function DeleteButton({ action, confirm = "حذف هذا السجل نهائياً؟" }: { action: () => Promise<ActionResult>; confirm?: string }) {
  return (
    <ActionButton action={action} confirm={confirm} className="btn btn-ghost btn-icon text-ink-3 hover:text-danger" label="حذف">
      <Trash2 size={16} />
    </ActionButton>
  );
}
