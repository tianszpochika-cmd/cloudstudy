package com.englishflow.commerce.adapter.http;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/** Hides client-controlled role/tenant/owner headers before authorization or controllers see them. */
public final class UntrustedCommerceFactsFilter extends OncePerRequestFilter {
    private static final Set<String> BLOCKED = Set.of("x-role", "x-b5-role", "x-tenant-id", "x-owner-id", "tenantid", "ownerid");

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public String getHeader(String name) { return blocked(name) ? null : super.getHeader(name); }
            @Override public Enumeration<String> getHeaders(String name) { return blocked(name) ? Collections.emptyEnumeration() : super.getHeaders(name); }
            @Override public Enumeration<String> getHeaderNames() {
                return Collections.enumeration(Collections.list(super.getHeaderNames()).stream().filter(name -> !blocked(name)).toList());
            }
            private boolean blocked(String name) { return name != null && BLOCKED.contains(name.toLowerCase(java.util.Locale.ROOT)); }
        }, response);
    }
}
