import React from "react";

interface InputProps {
  type?: string;
  id: string;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  inputCn?: string;
}
const Input = ({
  type = "text",
  id,
  label,
  value,
  onChange,
  placeholder,
  inputCn,
}: InputProps) => {
  return (
    <div className="inputWrapper">
      <label htmlFor={id}>{label}</label>
      <input
        className={inputCn && inputCn}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e)}
        placeholder={placeholder}
      />
    </div>
  );
};

export default Input;
