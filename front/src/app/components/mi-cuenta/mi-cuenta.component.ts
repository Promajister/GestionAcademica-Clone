import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  templateUrl: './mi-cuenta.component.html',
  styleUrls: ['./mi-cuenta.component.scss'],
})
export class MiCuentaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private photoKey = 'app.profilePhoto';
  loadingPhoto = false;

  user = this.auth.getCurrentUser() ?? {
    nombre: 'Usuario',
    email: 'correo@ejemplo.com',
    role: 'sin-rol',
  };
  photoDataUrl: string | null = null;

  profileForm: FormGroup = this.fb.group({
    nombre: [{ value: this.user.nombre, disabled: true }],
    email: [{ value: this.user.email, disabled: true }],
    role: [{ value: this.user.role, disabled: true }],
  });

  passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    {
      validators: (group) => {
        const newPass = group.get('newPassword')?.value;
        const confirm = group.get('confirmPassword')?.value;
        return newPass && confirm && newPass === confirm ? null : { passwordMismatch: true };
      },
    },
  );

  ngOnInit(): void {
    this.user = this.auth.getCurrentUser() ?? this.user;
    this.photoDataUrl =
      this.user?.fotoUrl ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(this.photoKey) : null);
    this.profileForm.patchValue({
      nombre: this.user?.nombre,
      email: this.user?.email,
      role: this.user?.role,
    });
  }

  get initials(): string {
    const n = this.user?.nombre || this.user?.email || '';
    const parts = n.trim().split(/\s+/);
    const [a = '', b = ''] = parts;
    const letters = (a[0] || '') + (b[0] || '');
    return letters.toUpperCase() || 'U';
  }

  onSelectPhoto(input: HTMLInputElement): void {
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const tooLarge = file.size > 1.5 * 1024 * 1024; // ~1.5MB

    if (!isImage) {
      this.snack.open('Selecciona una imagen válida.', 'Cerrar', { duration: 3000 });
      input.value = '';
      return;
    }

    if (tooLarge) {
      this.snack.open('La imagen debe pesar menos de 1.5MB.', 'Cerrar', { duration: 3000 });
      input.value = '';
      return;
    }

    this.loadingPhoto = true;
    this.auth.uploadAvatar(file).subscribe({
      next: (res) => {
        this.photoDataUrl = res.url;
        // user puede venir actualizado con fotoUrl
        if (res.user) {
          this.user = res.user;
        }
        this.snack.open('Foto actualizada', 'Cerrar', { duration: 2500 });
        this.loadingPhoto = false;
      },
      error: (err) => {
        this.snack.open(
          err?.error?.message || 'No se pudo subir la foto. Intenta de nuevo.',
          'Cerrar',
          { duration: 3500 },
        );
        this.loadingPhoto = false;
      },
      complete: () => {
        input.value = '';
      },
    });
  }

  submitPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    // No hay endpoint de cambio de contraseña aún; simulamos éxito para UX.
    this.snack.open('Tu contraseña se actualizará cuando el endpoint esté disponible.', 'Cerrar', {
      duration: 3500,
    });
    this.passwordForm.reset();
  }
}
