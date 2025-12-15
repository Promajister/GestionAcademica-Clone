import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  loading = false;

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { email } = this.form.value;

    this.auth.forgotPassword(email).subscribe({
      next: (res) => {
        this.loading = false;
        this.snackBar.open(
          res?.message ||
            'Si el correo existe, enviaremos una contraseña provisional a tu correo institucional.',
          'Cerrar',
          { duration: 5000, panelClass: 'success-snackbar' },
        );
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        this.snackBar.open(
          err?.error?.message || 'No se pudo procesar la solicitud.',
          'Cerrar',
          { duration: 5000, panelClass: 'error-snackbar' },
        );
      },
    });
  }

  backToLogin() {
    this.router.navigate(['/login']);
  }
}
