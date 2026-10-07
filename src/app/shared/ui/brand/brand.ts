import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type BrandProduct = 'stacktrace' | 'signal';
export type BrandVariant = 'desktop' | 'mobile' | 'footer';

@Component({
  imports: [RouterLink],
  selector: 'app-brand',
  templateUrl: './brand.html',
})
export class Brand {
  readonly product = input<BrandProduct>('stacktrace');
  readonly variant = input<BrandVariant>('desktop');
  readonly href = input('/');
}
